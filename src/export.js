// Export / share a finished story: a print-ready PDF, a square cover image for
// social, and share helpers that use the native share sheet on mobile (so the
// user can pick WhatsApp / Instagram / etc.) with sensible desktop fallbacks.

import { buildSlides } from './book'
import { narrationTextForSlide } from './narration'

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

// Build a cover-fit collage of the story photos as a JPEG (data URL + dims),
// matching the on-screen / HTML / video opening & closing covers. Returns null
// if no image loads.
async function buildCollageJpeg(srcs, W = 1200, H = 900) {
  const imgs = []
  for (const s of (srcs || []).slice(0, 9)) {
    try {
      imgs.push(await loadImage(s))
    } catch {
      /* skip an image that won't load */
    }
  }
  if (!imgs.length) return null
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  drawCollage(ctx, W, H, imgs)
  try {
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), w: W, h: H }
  } catch {
    return null
  }
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

  // Opening & closing pages show a collage of ALL the story photos — matching
  // the on-screen, HTML and video covers (and avoiding a single cover image that
  // duplicates the first/last page). Built once and reused for both.
  const photoSlides = slides.filter((s) => s.type === 'photo' && (s.styled || s.image || s.original))
  const photoSrcs = photoSlides.map((s) => s.styled || s.image || s.original)
  const collageImg = await buildCollageJpeg(photoSrcs)

  let first = true
  for (const s of slides) {
    if (!first) doc.addPage()
    first = false

    if (s.type === 'opening' || s.type === 'closing') {
      doc.setFillColor(247, 250, 252)
      doc.rect(0, 0, W, H, 'F')
      let y = M
      // Same collage on both covers; fall back to the first/last photo only if
      // the collage couldn't be built.
      const coverImg =
        collageImg ||
        (await toJpeg(s.type === 'opening' ? photoSrcs[0] : photoSrcs[photoSrcs.length - 1] || photoSrcs[0]))
      if (coverImg) {
        const boxW = W - 2 * M
        const boxH = H * 0.46
        const r = Math.min(boxW / coverImg.w, boxH / coverImg.h)
        const w = coverImg.w * r
        const h = coverImg.h * r
        try {
          doc.addImage(coverImg.dataUrl, 'JPEG', (W - w) / 2, y, w, h)
        } catch {
          /* skip a bad image */
        }
        y += h + 34
      } else {
        y = s.type === 'opening' ? 150 : 170
      }
      doc.setTextColor(...accent)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text((s.type === 'opening' ? s.vibe || '' : 'the end').toUpperCase(), W / 2, y, { align: 'center' })
      y += 36
      doc.setTextColor(...ink)
      doc.setFontSize(28)
      for (const line of wrap(s.title, 28, W - 2 * M)) {
        doc.text(line, W / 2, y, { align: 'center' })
        y += 34
      }
      y += 10
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      for (const line of wrap(s.text, 13, W - 2 * M)) {
        doc.text(line, W / 2, y, { align: 'center' })
        y += 19
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

    // Prefer the stylized image; fall back to the original upload so a page is
    // never blank.
    let img = null
    for (const cand of [s.styled, s.image, s.original]) {
      if (!cand) continue
      img = await toJpeg(cand)
      if (img) break
    }
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

// ------------------------------------------------------------- video ---------

// Render the story as a vertical (9:16) "Stories" video with the chosen narration
// voice as the soundtrack: each slide is held for the length of its narration clip
// (drawn live on a canvas) while the audio plays through a Web Audio destination;
// both tracks are captured together by one MediaRecorder so they stay in sync.
// Returns a Blob, or null when the browser can't record (e.g. older Safari).
export async function buildStoryVideoBlob(book, { lang = 'en', voice = 'female', fps = 30 } = {}) {
  if (typeof MediaRecorder === 'undefined') return null
  const W = 1080
  const H = 1920 // 9:16, Stories format
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  if (typeof canvas.captureStream !== 'function') return null
  const ctx = canvas.getContext('2d')

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const audioCtx = AudioCtx ? new AudioCtx() : null
  if (audioCtx) {
    try {
      await audioCtx.resume()
    } catch {
      /* may already be running */
    }
  }

  // Prefer a webm flavour that carries an opus audio track.
  const mime = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m))
  if (!mime) return null

  // Preload each slide's image + narration audio buffer up front.
  const slides = buildSlides(book)
  const frames = []
  for (const s of slides) {
    const src = s.type === 'photo' ? s.styled || s.image || s.original : null
    let img = null
    if (src) {
      try {
        img = await loadImage(src)
      } catch {
        img = null
      }
    }
    let audio = null
    const text = narrationTextForSlide(s)
    if (audioCtx && text) audio = await fetchNarrationBuffer(audioCtx, text, lang, voice)
    frames.push({ s, img, audio })
  }

  // Opening / closing frames show a collage of all the story photos — matching
  // the on-screen covers and the HTML export — rather than a single image.
  const collage = frames.filter((f) => f.s.type === 'photo' && f.img).map((f) => f.img)
  for (const f of frames) if (f.s.type !== 'photo') f.collage = collage

  const videoStream = canvas.captureStream(fps)
  const tracks = [...videoStream.getVideoTracks()]
  let dest = null
  if (audioCtx) {
    dest = audioCtx.createMediaStreamDestination()
    tracks.push(...dest.stream.getAudioTracks())
  }
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 5_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data)
  const stopped = new Promise((res) => (rec.onstop = res))

  rec.start()
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const durMs = (frame.audio ? frame.audio.duration * 1000 : 2200) + 350
    let srcNode = null
    if (frame.audio && dest) {
      srcNode = audioCtx.createBufferSource()
      srcNode.buffer = frame.audio
      srcNode.connect(dest)
      try {
        srcNode.start()
      } catch {
        /* ignore */
      }
    }
    const start = performance.now()
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - start
        drawVideoFrame(ctx, W, H, frame, Math.min(1, elapsed / durMs), i, frames.length)
        if (elapsed >= durMs) resolve()
        else requestAnimationFrame(tick)
      }
      tick()
    })
    if (srcNode) {
      try {
        srcNode.stop()
      } catch {
        /* already stopped */
      }
    }
  }
  rec.stop()
  await stopped
  if (audioCtx) {
    try {
      await audioCtx.close()
    } catch {
      /* ignore */
    }
  }
  return chunks.length ? new Blob(chunks, { type: mime }) : null
}

// Fetch a slide's narration as a decoded AudioBuffer (chosen language + voice).
// `translate: false` — the slide text is already in the chosen display language.
async function fetchNarrationBuffer(audioCtx, text, lang, voice) {
  try {
    const res = await fetch('/api/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, gender: voice, translate: false }),
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return await audioCtx.decodeAudioData(buf)
  } catch {
    return null
  }
}

const FONT = '"Plus Jakarta Sans", "Inter", Arial, sans-serif'
const ACCENT = '#0aa1dd'

function drawVideoFrame(ctx, W, H, frame, p, idx, total) {
  const { s, img } = frame
  ctx.save()
  ctx.filter = 'none'
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
  if (s.type === 'photo') drawPhotoFrame(ctx, W, H, s, img)
  else drawCoverFrame(ctx, W, H, s, frame.collage || [])
  ctx.restore()

  // Top "stories" progress bar — light on photos, tinted on the light covers.
  const isPhoto = s.type === 'photo'
  const pad = 28
  const gap = 8
  const segW = (W - pad * 2 - (total - 1) * gap) / total
  for (let i = 0; i < total; i++) {
    const x = pad + i * (segW + gap)
    ctx.fillStyle = isPhoto ? 'rgba(255,255,255,0.32)' : 'rgba(20,40,60,0.14)'
    roundRectPath(ctx, x, pad, segW, 5, 2.5)
    ctx.fill()
    const fillW = i < idx ? segW : i === idx ? segW * p : 0
    if (fillW > 0) {
      ctx.fillStyle = isPhoto ? '#ffffff' : ACCENT
      roundRectPath(ctx, x, pad, fillW, 5, 2.5)
      ctx.fill()
    }
  }
}

// Photo slide: blurred cover-fill backdrop + the whole photo (contain) + a bottom
// scrim + caption/narrative — matching the on-screen PhotoSlide.
function drawPhotoFrame(ctx, W, H, s, img) {
  ctx.fillStyle = '#0b1620'
  ctx.fillRect(0, 0, W, H)
  if (img) {
    ctx.save()
    ctx.filter = 'blur(55px) brightness(0.55)'
    drawCoverNoStroke(ctx, img, -60, -60, W + 120, H + 120)
    ctx.restore()
    drawContain(ctx, img, 0, 0, W, H)
  }
  // bottom scrim (to top): darkest at the bottom, fading out by ~58%
  const scrim = ctx.createLinearGradient(0, H, 0, H * 0.42)
  scrim.addColorStop(0, 'rgba(0,0,0,0.78)')
  scrim.addColorStop(0.42, 'rgba(0,0,0,0.4)')
  scrim.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, H * 0.42, W, H * 0.58)

  // caption (bold white) above narrative (light), both bottom-anchored
  ctx.textBaseline = 'alphabetic'
  const capFont = `800 56px ${FONT}`
  const narrFont = `500 36px ${FONT}`
  const narrLines = wrapLines(ctx, trim(s.narrative, 260), W - 120, narrFont).slice(0, 5)
  const capLines = wrapLines(ctx, s.caption || '', W - 120, capFont).slice(0, 3)
  ctx.fillStyle = '#eef2f6'
  const narrTop = drawLinesUp(ctx, narrLines, 60, H - 120, 50, narrFont, 'left')
  ctx.fillStyle = '#ffffff'
  drawLinesUp(ctx, capLines, 60, narrTop - 30, 64, capFont, 'left')
}

// Opening / closing cover: light Capsyl gradient, centered dark text, and a
// collage band of all photos across the bottom 46% — matching the on-screen cover.
function drawCoverFrame(ctx, W, H, s, collage) {
  const closing = s.type === 'closing'
  drawRadialBg(ctx, W, H, closing)
  const bandTop = Math.round(H * 0.54)
  if (collage && collage.length) drawCollageBand(ctx, 0, bandTop, W, H - bandTop, collage, closing)

  const parts = closing
    ? [
        { text: 'THE END', font: `700 30px ${FONT}`, color: ACCENT, lineH: 40, ls: 5, gap: 26 },
        { text: s.text || '', font: `500 44px ${FONT}`, color: '#46586a', lineH: 60, gap: 18 },
        { text: s.title || '', font: `700 48px ${FONT}`, color: ACCENT, lineH: 56 },
      ]
    : [
        s.vibe ? { text: String(s.vibe).toUpperCase(), font: `700 30px ${FONT}`, color: ACCENT, lineH: 40, ls: 5, gap: 26 } : null,
        { text: s.title || '', font: `800 84px ${FONT}`, color: '#16202c', lineH: 92, gap: 22 },
        { text: s.text || '', font: `500 40px ${FONT}`, color: '#46586a', lineH: 56 },
      ].filter(Boolean)
  drawCoverText(ctx, W, 40, bandTop - 20, parts)
}

function drawRadialBg(ctx, W, H, closing) {
  const cx = W / 2
  const cy = closing ? H * 0.82 : H * 0.18
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.95)
  if (closing) {
    g.addColorStop(0, '#e6faf5')
    g.addColorStop(0.55, '#f1fbf8')
    g.addColorStop(1, '#ffffff')
  } else {
    g.addColorStop(0, '#eaf6fc')
    g.addColorStop(0.55, '#f3f9fc')
    g.addColorStop(1, '#ffffff')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// Collage band at the bottom of a cover, matching the on-screen column logic
// (1 / 2 / 2-for-four / else 3) with thin gaps and a soft fade into the text.
function drawCollageBand(ctx, x, y, w, h, imgs, closing) {
  const list = imgs.slice(0, 9)
  const n = list.length
  if (!n) return
  const cols = n === 1 ? 1 : n === 2 ? 2 : n === 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const gap = 6
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
  const cellW = (w - gap * (cols - 1)) / cols
  const cellH = (h - gap * (rows - 1)) / rows
  let i = 0
  for (let r = 0; r < rows; r++) {
    const cellsThisRow = Math.min(cols, n - r * cols)
    for (let c = 0; c < cellsThisRow; c++) {
      drawCoverNoStroke(ctx, list[i++], x + c * (cellW + gap), y + r * (cellH + gap), cellW, cellH)
    }
  }
  // fade the top edge of the band into the cover background
  const [fr, fg, fb] = closing ? [242, 251, 248] : [244, 249, 252]
  const fade = ctx.createLinearGradient(0, y, 0, y + 160)
  fade.addColorStop(0, `rgb(${fr},${fg},${fb})`)
  fade.addColorStop(1, `rgba(${fr},${fg},${fb},0)`)
  ctx.fillStyle = fade
  ctx.fillRect(x, y, w, 160)
}

// Centered, vertically-centered stack of text parts within [top, bottom].
function drawCoverText(ctx, W, top, bottom, parts) {
  const maxW = W * 0.82
  const measured = parts.map((part) => {
    ctx.font = part.font
    ctx.letterSpacing = part.ls ? `${part.ls}px` : '0px'
    const lines = wrapLines(ctx, part.text, maxW, part.font).slice(0, 4)
    return { ...part, lines, h: lines.length * part.lineH }
  })
  ctx.letterSpacing = '0px'
  const totalGap = measured.reduce((sum, m) => sum + (m.gap || 0), 0)
  const totalH = measured.reduce((sum, m) => sum + m.h, 0) + totalGap
  let y = top + Math.max(0, (bottom - top - totalH) / 2)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const m of measured) {
    ctx.font = m.font
    ctx.fillStyle = m.color
    ctx.letterSpacing = m.ls ? `${m.ls}px` : '0px'
    for (const line of m.lines) {
      ctx.fillText(line, W / 2, y)
      y += m.lineH
    }
    y += m.gap || 0
  }
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

// Cover-fit an image into a box (clipped, no stroke).
function drawCoverNoStroke(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height)
  const iw = img.width * r
  const ih = img.height * r
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
  ctx.restore()
}

// Contain an image within a box (whole image visible, centered).
function drawContain(ctx, img, x, y, w, h) {
  const r = Math.min(w / img.width, h / img.height)
  const iw = img.width * r
  const ih = img.height * r
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
}


// Wrap text into lines that fit `maxW` for the given font.
function wrapLines(ctx, text, maxW, font) {
  ctx.font = font
  const words = String(text || '')
    .split(/\s+/)
    .filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

// Draw pre-wrapped lines ending at `bottomY` (growing upward). Returns the y of
// the top line so a block can be stacked above it.
function drawLinesUp(ctx, lines, x, bottomY, lineH, font, align) {
  if (!lines.length) return bottomY
  ctx.font = font
  if (align) ctx.textAlign = align
  const top = bottomY - (lines.length - 1) * lineH
  let y = top
  for (const l of lines) {
    ctx.fillText(l, x, y)
    y += lineH
  }
  return top - lineH * 0.8
}

// Tile the story photos to fill the frame (cover-fit per cell, thin white gaps),
// matching the on-screen / HTML cover collage.
function drawCollage(ctx, W, H, imgs) {
  const list = imgs.slice(0, 9)
  const n = list.length
  if (!n) return
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const cellH = H / rows
  let i = 0
  for (let r = 0; r < rows; r++) {
    const cellsThisRow = Math.min(cols, n - r * cols)
    const cellW = W / cellsThisRow
    for (let c = 0; c < cellsThisRow; c++) {
      drawCover(ctx, list[i++], c * cellW, r * cellH, cellW, cellH)
    }
  }
}

function drawCover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height)
  const iw = img.width * r
  const ih = img.height * r
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih)
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 4
  ctx.strokeRect(x, y, w, h)
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function trim(s, n) {
  const t = String(s || '').trim()
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t
}

function drawWrapped(ctx, text, x, yBottom, maxW, lineH, font, align) {
  if (!text) return
  ctx.font = font
  if (align) ctx.textAlign = align
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  let y = yBottom - (lines.length - 1) * lineH
  for (const l of lines) {
    ctx.fillText(l, x, y)
    y += lineH
  }
}

export async function downloadStoryVideo(book, opts) {
  const blob = await buildStoryVideoBlob(book, opts)
  if (blob) triggerDownload(blob, slugify(book && book.title) + '.webm')
  return !!blob
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

// Share the story as a vertical narrated video; if the browser can't record one,
// fall back to the cover image so something visual is always shared.
async function shareVideoOrCover(book, title, text, opts) {
  try {
    const video = await buildStoryVideoBlob(book, opts)
    if (video) {
      const file = new File([video], slugify(title) + '.webm', { type: video.type || 'video/webm' })
      if (await shareFiles([file], title, text)) return true
      triggerDownload(video, slugify(title) + '.webm')
      return true
    }
  } catch {
    /* fall through to the cover image */
  }
  const cover = await buildCoverPngBlob(book)
  if (cover) {
    const file = new File([cover], slugify(title) + '.png', { type: 'image/png' })
    if (await shareFiles([file], title, text)) return true
    triggerDownload(cover, slugify(title) + '.png')
    return true
  }
  return false
}

// WhatsApp: share the narrated Stories video via the native sheet (mobile); on
// desktop with no share support, open WhatsApp Web prefilled with a message.
export async function shareToWhatsApp(book, opts) {
  const title = (book && book.title) || 'Our Story'
  const text = `${title} — a little photo story 📖`
  if (await shareVideoOrCover(book, title, text, opts)) return
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener')
}

// Instagram has no web post intent: share the narrated Stories video (or cover
// image) via the native sheet so the user can pick Instagram, or download it.
export async function shareToInstagram(book, opts) {
  const title = (book && book.title) || 'Our Story'
  await shareVideoOrCover(book, title, '', opts)
}

// Render the narrated video, upload it, and get back a hosted MP4 + story page.
// The page has rich link previews (WhatsApp) and a "Share to Instagram" button
// that hands over the real MP4. Returns { id, pageUrl, mp4Url } or throws.
export async function createShareLink(book, opts) {
  const blob = await buildStoryVideoBlob(book, opts)
  if (!blob) throw new Error("This browser can't record the share video.")
  const title = (book && book.title) || 'Our Story'
  const res = await fetch('/api/share?title=' + encodeURIComponent(title), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).error || ''
    } catch {
      /* ignore */
    }
    throw new Error(res.status === 501 ? 'Video transcoding (ffmpeg) is not available on the server.' : 'share ' + res.status + (detail ? ': ' + detail : ''))
  }
  return res.json()
}
