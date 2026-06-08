// Export / share a finished story: a print-ready PDF, a square cover image for
// social, and share helpers that use the native share sheet on mobile (so the
// user can pick WhatsApp / Instagram / etc.) with sensible desktop fallbacks.

import { buildSlides } from './book'

function slugify(s) {
  return (
    String(s || 'photobook-story')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'photobook-story'
  )
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

// Decode an image source (data URL or http) to a JPEG data URL + dimensions.
// Returns null if it can't be read (e.g. a CORS-tainted canvas).
async function toJpeg(src) {
  try {
    const img = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    canvas.getContext('2d').drawImage(img, 0, 0)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), w: canvas.width, h: canvas.height }
  } catch {
    return null
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// ---------------------------------------------------------------- PDF --------

// Build a print-ready PDF (cover + one page per photo + closing) as a Blob.
export async function buildStoryPdfBlob(book) {
  const { jsPDF } = await import('jspdf') // lazy — keeps it out of the main bundle
  const slides = buildSlides(book)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const accent = [10, 161, 221]
  const ink = [22, 32, 44]
  const muted = [90, 105, 120]

  const wrap = (text, size, maxW) => {
    doc.setFontSize(size)
    return doc.splitTextToSize(String(text || ''), maxW)
  }

  let first = true
  for (const s of slides) {
    if (!first) doc.addPage()
    first = false

    if (s.type === 'opening' || s.type === 'closing') {
      doc.setFillColor(247, 250, 252)
      doc.rect(0, 0, W, H, 'F')
      let y = s.type === 'opening' ? 150 : 170
      doc.setTextColor(...accent)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text((s.type === 'opening' ? s.vibe || '' : 'the end').toUpperCase(), W / 2, y, { align: 'center' })
      y += 36
      doc.setTextColor(...ink)
      doc.setFontSize(30)
      for (const line of wrap(s.title, 30, W - 2 * M)) {
        doc.text(line, W / 2, y, { align: 'center' })
        y += 36
      }
      y += 10
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      for (const line of wrap(s.text, 14, W - 2 * M)) {
        doc.text(line, W / 2, y, { align: 'center' })
        y += 20
      }
      continue
    }

    // photo page
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, W, H, 'F')
    let y = M + 6
    if (s.caption) {
      doc.setTextColor(...ink)
      doc.setFont('helvetica', 'bold')
      for (const line of wrap(s.caption, 18, W - 2 * M)) {
        doc.text(line, M, y)
        y += 24
      }
      y += 6
    }

    const img = s.image ? await toJpeg(s.image) : null
    if (img) {
      const boxW = W - 2 * M
      const boxH = H - y - (s.narrative ? 150 : M) - 10
      const r = Math.min(boxW / img.w, boxH / img.h)
      const w = img.w * r
      const h = img.h * r
      const x = (W - w) / 2
      try {
        doc.addImage(img.dataUrl, 'JPEG', x, y, w, h)
      } catch {
        /* skip a bad image */
      }
      y += h + 22
    }

    if (s.narrative) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      for (const line of wrap(s.narrative, 13, W - 2 * M)) {
        doc.text(line, M, y)
        y += 19
      }
    }
    if (s.styleApplied) {
      doc.setFontSize(9)
      doc.setTextColor(...accent)
      doc.text(String(s.styleApplied).replace(/_/g, ' ').toUpperCase(), M, H - M + 8)
    }
  }

  return doc.output('blob')
}

export async function downloadStoryPdf(book) {
  const blob = await buildStoryPdfBlob(book)
  triggerDownload(blob, slugify(book && book.title) + '.pdf')
}

// ------------------------------------------------------------- cover PNG -----

// A 1080×1080 social card: the first photo (cover-fit) with the title overlaid.
export async function buildCoverPngBlob(book) {
  const slides = buildSlides(book)
  const cover = slides.find((s) => s.type === 'photo' && s.image)
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#0b1620'
  ctx.fillRect(0, 0, size, size)
  if (cover) {
    try {
      const img = await loadImage(cover.image)
      // object-fit: cover
      const r = Math.max(size / img.width, size / img.height)
      const w = img.width * r
      const h = img.height * r
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    } catch {
      /* keep the dark backdrop */
    }
  }
  // bottom scrim for legible text
  const grad = ctx.createLinearGradient(0, size * 0.45, 0, size)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const title = (book && book.title) || 'Our Story'
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '800 76px "Plus Jakarta Sans", Arial, sans-serif'
  // simple word-wrap
  const words = String(title).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > size - 120 && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  let y = size - 90 - (lines.length - 1) * 84
  for (const l of lines) {
    ctx.fillText(l, 70, y)
    y += 84
  }
  ctx.font = '700 26px "Plus Jakarta Sans", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText('· Photobook ·', 72, Math.min(size - 40, y + 6))

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

// ------------------------------------------------------------- sharing -------

async function shareFiles(files, title, text) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title, text })
      return true
    }
  } catch {
    /* user cancelled or share failed — fall through to the fallback */
  }
  return false
}

// WhatsApp: share the PDF via the native sheet (mobile); on desktop open
// WhatsApp Web prefilled with a message.
export async function shareToWhatsApp(book) {
  const title = (book && book.title) || 'Our Story'
  const text = `${title} — a little photo story 📖`
  try {
    const blob = await buildStoryPdfBlob(book)
    const file = new File([blob], slugify(title) + '.pdf', { type: 'application/pdf' })
    if (await shareFiles([file], title, text)) return
  } catch {
    /* fall through */
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener')
}

// Instagram has no web post intent: share the cover image via the native sheet
// (mobile → pick Instagram), or download it so the user can post it manually.
export async function shareToInstagram(book) {
  const title = (book && book.title) || 'Our Story'
  const blob = await buildCoverPngBlob(book)
  if (blob) {
    const file = new File([blob], slugify(title) + '.png', { type: 'image/png' })
    if (await shareFiles([file], title, '')) return
    triggerDownload(blob, slugify(title) + '.png')
  }
}
