'use client'

import { toJpeg, toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

/**
 * Shared helpers for payment receipts (Donation / Drawing / Tournament):
 * render the receipt DOM node → a real PDF file for download (saved to the
 * device storage) and a JPEG image for WhatsApp-first sharing.
 * Everything here is client-side only.
 */

/** Decode a data: URL into a File without fetch (works in every WebView). */
function dataUrlToFile(dataUrl: string, filename: string, mime: string): File {
  const [, b64] = dataUrl.split(',')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
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

/**
 * Render a receipt node and download it as a real PDF file — the PDF page is
 * sized exactly like the receipt (1 page, 1:1), so it saves cleanly to the
 * device storage (Downloads folder) and prints without any scaling.
 */
export async function downloadNodePdf(node: HTMLElement, filename: string): Promise<void> {
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
  pdf.save(filename)
}

/** Render a receipt node to a JPEG File (3× crisp, white background). */
export async function nodeToJpegFile(node: HTMLElement, filename: string): Promise<File> {
  const dataUrl = await toJpeg(node, {
    quality: 0.95,
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })
  return dataUrlToFile(dataUrl, filename, 'image/jpeg')
}

export type ShareOutcome = 'shared' | 'whatsapp' | 'copied' | 'abort' | 'failed'

/**
 * Share a receipt image — WhatsApp first:
 *
 *  1. Web Share API with the JPEG file → native share sheet (WhatsApp one tap
 *     away, image attached). This is the only web path that can attach an image.
 *  2. Direct WhatsApp — `whatsapp://send?text=…` opens the WhatsApp app with
 *     the receipt details prefilled (an image cannot be attached without the
 *     share sheet). Falls back to wa.me if the app doesn't open.
 *  3. Desktop → wa.me in a new tab (WhatsApp Web with the details).
 *  4. Last resort → copy the details to the clipboard.
 */
export async function shareReceipt(opts: {
  file: File
  title: string
  /** caption for the share-sheet image */
  text: string
  /** plain-text receipt used by the direct-WhatsApp fallbacks */
  whatsappText: string
}): Promise<ShareOutcome> {
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
