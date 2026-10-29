'use client'

import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'

/**
 * Render an on-screen DOM node (A4-width report card) into a real PDF file.
 *
 * Why canvas → PDF instead of jsPDF text calls? The report contains Bengali
 * script — jsPDF's built-in fonts can't shape complex Indic text (conjuncts,
 * matras) and would print garbage. Rendering the browser-laid-out node with
 * html-to-image keeps every glyph pixel-perfect, and the image is then sliced
 * across as many A4 pages as needed.
 */
export async function downloadNodeAsPdf(node: HTMLElement, filename: string): Promise<void> {
  const A4_W_MM = 210
  const A4_H_MM = 297
  const MARGIN_MM = 0 // the node itself carries its own white margins

  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' })
  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('image decode failed'))
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = A4_W_MM - MARGIN_MM * 2
  const pxPerMm = img.width / pageW
  const pageHpx = A4_H_MM * pxPerMm
  const pages = Math.max(1, Math.ceil(img.height / pageHpx))

  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage()
    // slide the same full image up by p pages and clip to the page window
    pdf.addImage(dataUrl, 'PNG', 0, -p * A4_H_MM, pageW, img.height / pxPerMm, undefined, 'FAST')
  }
  pdf.save(filename)
}
