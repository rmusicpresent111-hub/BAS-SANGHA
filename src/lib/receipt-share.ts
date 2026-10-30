'use client'

import { toJpeg, toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { registerPlugin } from '@capacitor/core'

/**
 * Shared helpers for payment receipts (Donation / Drawing / Tournament):
 *
 *  • Download  → a real PDF file (page sized 1:1 with the receipt).
 *      – Inside the Capacitor Android app the WebView cannot download blobs,
 *        so the PDF bytes are written straight into the device Downloads
 *        folder through a small native MediaStore plugin (no permission
 *        needed on Android 10+). Old devices fall back to cache + share.
 *      – On the website the browser's own download flow is used.
 *
 *  • WhatsApp share → the receipt rendered as a JPEG image.
 *      – Android WebView has no Web Share API, so inside the app the JPEG is
 *        written to the cache dir and handed to the native @capacitor/share
 *        plugin — the Android share sheet opens and WhatsApp receives the
 *        actual image file.
 *      – On the website the Web Share API (with the JPEG file) is used, with
 *        a WhatsApp-text fallback for desktop browsers.
 *
 * Everything here is client-side only.
 */

/** Custom local plugin (android/app/src/main/java/com/bassangha/app/SaveToDownloads.java). */
interface SaveToDownloadsPlugin {
  save(options: { data: string; filename: string; mime: string }): Promise<{ uri?: string }>
}

const SaveToDownloads = registerPlugin<SaveToDownloadsPlugin>('SaveToDownloads')

/** True inside the Capacitor Android APK shell (the injected bridge exists). */
function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return !!cap?.isNativePlatform?.()
}

/** Lazily import the native share/file plugins (kept out of the web bundle). */
async function nativeShareHelpers() {
  const [{ Share }, { Filesystem, Directory }] = await Promise.all([
    import('@capacitor/share'),
    import('@capacitor/filesystem'),
  ])
  return { Share, Filesystem, Directory }
}

/** File → raw base64 (Filesystem.writeFile expects base64, no data: prefix). */
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/** Load a data: URL into an Image so its exact pixel size can be read. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('receipt image decode failed'))
    img.src = dataUrl
  })
}

/** Render a receipt node to a JPEG File (3× crisp, white background). */
export async function nodeToJpegFile(node: HTMLElement, filename: string): Promise<File> {
  const dataUrl = await toJpeg(node, {
    quality: 0.95,
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })
  const [, b64] = dataUrl.split(',')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: 'image/jpeg' })
}

export type DownloadOutcome = 'saved' | 'shared' | 'downloaded'

/**
 * Render a receipt node and save it as a real PDF — page sized exactly like
 * the receipt (1 page, 1:1), so it prints/saves cleanly.
 */
export async function downloadNodePdf(
  node: HTMLElement,
  filename: string
): Promise<DownloadOutcome> {
  const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true })
  const img = await loadImage(dataUrl)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const pdf = new jsPDF({
    orientation: w > h ? 'landscape' : 'portrait',
    unit: 'px',
    format: [w, h],
    compress: true,
  })
  pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)

  if (isNativeApp()) {
    const dataUri = pdf.output('datauristring')
    const b64 = dataUri.slice(dataUri.indexOf(',') + 1)
    // 1st choice: straight into the device Downloads folder (MediaStore —
    // no storage permission needed on Android 10+, shows in the Files app).
    try {
      await SaveToDownloads.save({ data: b64, filename, mime: 'application/pdf' })
      return 'saved'
    } catch {
      // very old Android / MediaStore rejected → cache file + share sheet
      // (the user can pick "Files" there to save it).
      const { Share, Filesystem, Directory } = await nativeShareHelpers()
      const f = await Filesystem.writeFile({
        path: filename,
        data: b64,
        directory: Directory.Cache,
        recursive: true,
      })
      await Share.share({
        title: filename,
        files: [f.uri],
        dialogTitle: 'Save or share the receipt PDF',
      })
      return 'shared'
    }
  }

  // browser: standard download → Downloads folder
  pdf.save(filename)
  return 'downloaded'
}

export type ShareOutcome = 'shared' | 'whatsapp' | 'copied' | 'abort' | 'failed'

/**
 * Share a receipt image — WhatsApp first:
 *
 *  1. Inside the APK → native share sheet via @capacitor/share with the JPEG
 *     file attached (WhatsApp receives the actual image).
 *  2. On the web → Web Share API with the JPEG file → native share sheet.
 *  3. Fallbacks — `whatsapp://send?text=…` (app) / wa.me (desktop) with the
 *     receipt details, last resort copy to the clipboard.
 */
export async function shareReceipt(opts: {
  file: File
  title: string
  /** caption for the share-sheet image */
  text: string
  /** plain-text receipt used by the direct-WhatsApp fallbacks */
  whatsappText: string
}): Promise<ShareOutcome> {
  if (isNativeApp()) {
    try {
      const { Share, Filesystem, Directory } = await nativeShareHelpers()
      const b64 = await fileToBase64(opts.file)
      const f = await Filesystem.writeFile({
        path: opts.file.name,
        data: b64,
        directory: Directory.Cache,
        recursive: true,
      })
      await Share.share({
        title: opts.title,
        text: opts.text,
        files: [f.uri],
        dialogTitle: 'Share receipt via WhatsApp',
      })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'abort'
      // native share failed → try WhatsApp text below
    }
    return shareTextToWhatsApp(opts.whatsappText)
  }

  const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean }
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [opts.file] })) {
    try {
      await navigator.share({ files: [opts.file], title: opts.title, text: opts.text })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'abort'
      // share sheet failed → try WhatsApp directly below
    }
  }
  return shareTextToWhatsApp(opts.whatsappText)
}

/** Open WhatsApp directly with prefilled receipt text (app on mobile, web on desktop). */
export function shareTextToWhatsApp(text: string): ShareOutcome {
  const details = encodeURIComponent(text)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile) {
    // try the WhatsApp app scheme; if the app is missing nothing opens, so a
    // 1.2s timer falls back to wa.me (universal link → app or WhatsApp Web).
    const fallback = setTimeout(() => {
      window.location.href = `https://wa.me/?text=${details}`
    }, 1200)
    document.addEventListener(
      'visibilitychange',
      () => clearTimeout(fallback),
      { once: true }
    )
    window.location.href = `whatsapp://send?text=${details}`
    return 'whatsapp'
  }
  const win = window.open(`https://wa.me/?text=${details}`, '_blank')
  if (win) {
    win.opener = null // security: don't expose this page to wa.me
    return 'whatsapp'
  }
  // popup blocked → copy the details so nothing is lost
  void (async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* nothing else we can do */
    }
  })()
  return 'copied'
}
