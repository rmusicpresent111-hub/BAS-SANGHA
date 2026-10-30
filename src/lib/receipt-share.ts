'use client'

import { toJpeg, toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { registerPlugin } from '@capacitor/core'

/**
 * Shared helpers for payment receipts (Donation / Drawing / Tournament),
 * the member ID card and the admin reports:
 *
 *  • Download → a real file saved straight into the device's Downloads
 *    folder (Photos/Files app → Downloads). Inside the Capacitor Android
 *    app the WebView cannot download blobs/data-URLs, so every download
 *    goes through the small native MediaStore plugin (SaveToDownloads —
 *    no storage permission needed on Android 10+; on older devices the
 *    permission is asked once when the app first opens). If MediaStore
 *    fails, the file is written to the app cache and the Android share
 *    sheet opens so the user can pick "Files" to save it.
 *    On the website the browser's own download flow is used.
 *
 *  • WhatsApp share → the receipt rendered as a JPEG image.
 *      – Android WebView has no Web Share API, so inside the app the JPEG
 *        is written to the cache dir and handed to the native
 *        @capacitor/share plugin — the Android share sheet opens and
 *        WhatsApp receives the actual image file.
 *      – On the website the Web Share API (with the JPEG file) is used,
 *        with a WhatsApp-text fallback for desktop browsers.
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

/**
 * Error thrown when the installed APK is too old to contain the native
 * download/share plugins (every call ends in Capacitor's "not implemented").
 */
export const APP_UPDATE_MESSAGE =
  'নতুন APK install করুন — পুরনো অ্যাপ ভার্সনে download কাজ করে না। GitHub Releases থেকে সর্বশেষ ভার্সন নিন।'

/** Capacitor's error when a plugin is not registered in the native shell. */
function isNotImplementedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /not implemented/i.test(msg)
}

/** Blob/File → raw base64 (native plugins expect base64, no data: prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/** data: URL → Blob (keeps the mime type from the URL). */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
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
  const blob = await dataUrlToBlob(dataUrl)
  return new File([blob], filename, { type: 'image/jpeg' })
}

export type SaveOutcome = 'saved' | 'shared' | 'downloaded'

/**
 * Save any blob/file directly into the device storage:
 *
 *  – APK: written into the public Downloads folder through the native
 *    MediaStore plugin (no dialog, no permission on Android 10+). If
 *    MediaStore rejects it, the file goes to the app cache and the Android
 *    share sheet opens — picking "Files" saves it from there.
 *  – Browser: standard anchor download → Downloads folder.
 *
 * Throws {@link APP_UPDATE_MESSAGE} when the APK predates the native
 * plugins, so the UI can tell the user to update the app.
 */
export async function saveBlobToDevice(
  blob: Blob,
  filename: string,
  mime: string
): Promise<SaveOutcome> {
  if (isNativeApp()) {
    const b64 = await blobToBase64(blob)
    try {
      await SaveToDownloads.save({ data: b64, filename, mime })
      return 'saved'
    } catch (err) {
      if (isNotImplementedError(err)) throw new Error(APP_UPDATE_MESSAGE)
      // MediaStore rejected → cache file + share sheet (user picks "Files")
      const { Share, Filesystem, Directory } = await nativeShareHelpers()
      try {
        const f = await Filesystem.writeFile({
          path: filename,
          data: b64,
          directory: Directory.Cache,
          recursive: true,
        })
        await Share.share({
          title: filename,
          files: [f.uri],
          dialogTitle: 'Save or share the file',
        })
        return 'shared'
      } catch (err2) {
        if (isNotImplementedError(err2)) throw new Error(APP_UPDATE_MESSAGE)
        throw err2
      }
    }
  }

  // browser: standard download → Downloads folder
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

/**
 * Render a receipt node and save it as a real PDF — page sized exactly like
 * the receipt (1 page, 1:1), so it prints/saves cleanly.
 */
export async function downloadNodePdf(
  node: HTMLElement,
  filename: string
): Promise<SaveOutcome> {
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
  return saveBlobToDevice(pdf.output('blob'), filename, 'application/pdf')
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
      const b64 = await blobToBase64(opts.file)
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
