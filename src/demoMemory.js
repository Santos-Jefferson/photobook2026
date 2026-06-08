// Example "memories" — the shape we'd pull from Capsyl Memories: a themed
// cluster of photos summarized by a single title and a date range. Each memory's
// photos are drawn on a canvas at runtime (flat-illustration scenes) so nothing
// binary ships in the repo and they flow through the normal upload pipeline as
// JPEG File objects. We also bake a Capsyl-style cover (title in a display font
// over the lead photo) used on the gallery card and as the photobook cover.

export const MEMORIES = [
  {
    id: 'lake',
    title: 'A Day at the Lake',
    dateRange: 'Jun 2 – Jun 2, 2026',
    font: "Georgia, 'Times New Roman', serif",
    uppercase: false,
    context:
      'A family spends a summer day together at a mountain lake: arriving at dawn, ' +
      'canoeing out on the water, a picnic by the shore, jumping off the dock, and a ' +
      'campfire under the stars.',
    cover: 'dawn',
    scenes: [
      { type: 'dawn', file: 'lake-1-arrival.jpg' },
      { type: 'canoe', file: 'lake-2-canoe.jpg' },
      { type: 'picnic', file: 'lake-3-picnic.jpg' },
      { type: 'jump', file: 'lake-4-jump.jpg' },
      { type: 'campfire', file: 'lake-5-campfire.jpg' },
    ],
  },
  {
    id: 'city',
    title: 'Golden Hour in the City',
    dateRange: 'May 24 – May 25, 2026',
    font: "'Trebuchet MS', 'Segoe UI', sans-serif",
    uppercase: true,
    context:
      'A weekend in the city: rooftops at sunset, walking the busy streets, a bright ' +
      'afternoon in the park, and the skyline lighting up after dark.',
    cover: 'city-sunset',
    scenes: [
      { type: 'city-sunset', file: 'city-1-rooftop.jpg' },
      { type: 'city-street', file: 'city-2-street.jpg' },
      { type: 'city-day', file: 'city-3-skyline.jpg' },
      { type: 'city-park', file: 'city-4-park.jpg' },
      { type: 'city-night', file: 'city-5-night.jpg' },
    ],
  },
  {
    id: 'trail',
    title: 'Autumn on the Ridge',
    dateRange: 'Oct 11 – Oct 12, 2025',
    font: "Georgia, 'Times New Roman', serif",
    uppercase: true,
    context:
      'A crisp autumn hike: a golden sunrise, the long climb up the ridge, walking ' +
      'through the woods, resting in a meadow, and a fire under the stars.',
    cover: 'trail-ridge',
    scenes: [
      { type: 'trail-dawn', file: 'trail-1-sunrise.jpg' },
      { type: 'trail-ridge', file: 'trail-2-ridge.jpg' },
      { type: 'trail-forest', file: 'trail-3-forest.jpg' },
      { type: 'trail-meadow', file: 'trail-4-meadow.jpg' },
      { type: 'trail-night', file: 'trail-5-night.jpg' },
    ],
  },
]

const W = 1080
const H = 1350

export function getMemory(id) {
  return MEMORIES.find((m) => m.id === id) || MEMORIES[0]
}

// All five scenes of a memory as JPEG File objects, ready for the picker.
export async function buildMemoryFiles(memory) {
  const files = []
  for (const s of memory.scenes) files.push(await renderSceneFile(s.type, s.file))
  return files
}

// The lead scene as a plain data URL (no title) — the gallery overlays the title
// with real CSS fonts on top of this.
export function memoryCoverImage(memory) {
  const c = newCanvas()
  drawScene(c.getContext('2d'), c.width, c.height, memory.cover)
  return c.toDataURL('image/jpeg', 0.82)
}

// A baked Capsyl-style cover: the lead scene + a dark gradient + the title (in the
// memory's display font) and date range — used as the photobook cover.
export function bakeMemoryCover(memory) {
  const c = newCanvas()
  const ctx = c.getContext('2d')
  drawScene(ctx, W, H, memory.cover)
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  const title = memory.uppercase ? memory.title.toUpperCase() : memory.title
  const size = title.length > 18 ? 76 : 92
  ctx.font = `800 ${size}px ${memory.font}`
  wrapText(ctx, title, 64, H - 150, W - 128, size * 1.04)
  ctx.font = `600 34px ${memory.font}`
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText(memory.dateRange, 66, H - 80)
  return c.toDataURL('image/jpeg', 0.9)
}

function wrapText(ctx, text, x, yBottom, maxW, lineH) {
  const words = String(text).split(' ')
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

function newCanvas() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return c
}

function renderSceneFile(type, name) {
  return new Promise((resolve) => {
    const c = newCanvas()
    drawScene(c.getContext('2d'), c.width, c.height, type)
    c.toBlob((b) => resolve(new File([b], name, { type: 'image/jpeg' })), 'image/jpeg', 0.9)
  })
}

// ---- scene compositor --------------------------------------------------------

function drawScene(ctx, w, h, type) {
  const waterTop = h * 0.62
  switch (type) {
    // --- lake ---
    case 'dawn':
      sky(ctx, w, h, ['#fde0c2', '#f7b08a', '#c98aa8', '#8f7bb0'])
      sun(ctx, w * 0.5, h * 0.34, 70, '#fff2cf', 0.5)
      hills(ctx, w, h, waterTop, 120, '#6f6597', 0.4)
      hills(ctx, w, h, waterTop, 80, '#574e7e', 2.1)
      lake(ctx, w, h, waterTop, ['#9aa6c4', '#6f6f9c'])
      sunReflection(ctx, w * 0.5, waterTop, h, 60, 'rgba(255,240,200,0.5)')
      dock(ctx, w, h, waterTop)
      break
    case 'canoe':
      sky(ctx, w, h, ['#bfe3f5', '#9fd2ef', '#7cc0e8'])
      sun(ctx, w * 0.74, h * 0.18, 56, '#fffbe6', 0.7)
      hills(ctx, w, h, waterTop, 150, '#8bbf8a', 0.8)
      hills(ctx, w, h, waterTop, 95, '#5f9e6a', 2.6)
      lake(ctx, w, h, waterTop, ['#7fc2e6', '#3f86b8'])
      ripples(ctx, w, waterTop, h)
      canoe(ctx, w * 0.5, h * 0.82, 1)
      break
    case 'picnic':
      sky(ctx, w, h, ['#cdeafc', '#a7d8f3'])
      sun(ctx, w * 0.2, h * 0.16, 52, '#fffbe6', 0.7)
      hills(ctx, w, h, h * 0.4, 110, '#7fb6d8', 0.5)
      lake(ctx, w, h, h * 0.4, ['#79bfe2', '#4f97c4'], h * 0.58)
      meadow(ctx, w, h, h * 0.58, ['#9cc878', '#6fa651'])
      tree(ctx, w * 0.16, h * 0.56, 1.1)
      tree(ctx, w * 0.86, h * 0.52, 1.35)
      blanket(ctx, w * 0.5, h * 0.86)
      break
    case 'jump':
      sky(ctx, w, h, ['#d6efff', '#a9dcf6', '#79c4ea'])
      sun(ctx, w * 0.8, h * 0.2, 60, '#fffbe6', 0.8)
      hills(ctx, w, h, waterTop, 120, '#86c08f', 1.2)
      lake(ctx, w, h, waterTop, ['#6fb9e0', '#327fb0'])
      dock(ctx, w, h, waterTop, 'left')
      figure(ctx, w * 0.6, h * 0.52, 1.15, '#2b3a4a', 'jump')
      splash(ctx, w * 0.62, waterTop + 24)
      break
    case 'campfire':
      sky(ctx, w, h, ['#142244', '#27325c', '#3b3a63'])
      stars(ctx, w, h * 0.6)
      sun(ctx, w * 0.78, h * 0.16, 46, '#f6f2d8', 0.35)
      hills(ctx, w, h, waterTop, 130, '#1f2742', 0.9)
      hills(ctx, w, h, waterTop, 85, '#161b32', 2.4)
      lake(ctx, w, h, waterTop, ['#26345c', '#141d38'])
      sunReflection(ctx, w * 0.78, waterTop, h, 40, 'rgba(246,242,216,0.35)')
      campfire(ctx, w * 0.5, h * 0.84)
      figure(ctx, w * 0.36, h * 0.83, 0.9, '#0c1020', 'sit')
      figure(ctx, w * 0.64, h * 0.83, 0.9, '#0c1020', 'sit')
      break

    // --- city ---
    case 'city-sunset':
      sky(ctx, w, h, ['#ffd9a0', '#ff9e6d', '#e06a8c', '#7a5b9e'])
      sun(ctx, w * 0.5, h * 0.42, 80, '#fff0c8', 0.6)
      buildings(ctx, w, h * 0.78, { color: '#5a4a6e' })
      buildings(ctx, w, h * 0.84, { color: '#3c3151', offset: 40 })
      street(ctx, w, h, h * 0.84, '#2b2440')
      break
    case 'city-street':
      sky(ctx, w, h, ['#cfe7fb', '#a9d2f2'])
      buildings(ctx, w, h * 0.66, { color: '#7e8aa6', windows: true })
      road(ctx, w, h, h * 0.66)
      cars(ctx, w, h * 0.86)
      break
    case 'city-day':
      sky(ctx, w, h, ['#bfe3fb', '#8ec6ef'])
      sun(ctx, w * 0.16, h * 0.16, 56, '#fffbe6', 0.7)
      buildings(ctx, w, h * 0.74, { color: '#9aa7c2', windows: true })
      buildings(ctx, w, h * 0.8, { color: '#7c89a8', windows: true, offset: 55 })
      street(ctx, w, h, h * 0.8, '#566079')
      break
    case 'city-park':
      sky(ctx, w, h, ['#cdeafc', '#a7d8f3'])
      buildings(ctx, w, h * 0.5, { color: '#8b97b4', windows: true })
      meadow(ctx, w, h, h * 0.5, ['#94c46f', '#6aa24c'])
      tree(ctx, w * 0.2, h * 0.5, 1.25)
      tree(ctx, w * 0.82, h * 0.47, 1.45)
      blanket(ctx, w * 0.52, h * 0.84)
      break
    case 'city-night':
      sky(ctx, w, h, ['#0d1a3a', '#1d2750', '#33305c'])
      stars(ctx, w, h * 0.55)
      sun(ctx, w * 0.8, h * 0.16, 44, '#f3efd6', 0.4)
      buildings(ctx, w, h * 0.82, { color: '#10162e', lit: true })
      street(ctx, w, h, h * 0.82, '#0a0f22')
      break

    // --- trail (autumn) ---
    case 'trail-dawn':
      sky(ctx, w, h, ['#ffe6b8', '#ffb877', '#e88a6a', '#9c6f86'])
      sun(ctx, w * 0.5, h * 0.32, 72, '#fff2cf', 0.55)
      hills(ctx, w, h, h * 0.62, 150, '#b9764a', 0.4)
      hills(ctx, w, h, h * 0.62, 95, '#8a5436', 2.1)
      meadow(ctx, w, h, h * 0.7, ['#caa24e', '#a9802f'])
      tree(ctx, w * 0.84, h * 0.66, 1.3, ['#c8772e', '#d89234', '#b85f22'])
      break
    case 'trail-ridge':
      sky(ctx, w, h, ['#cfe6f2', '#bcd8e6', '#e6d3b0'])
      sun(ctx, w * 0.74, h * 0.2, 54, '#fffbe6', 0.6)
      hills(ctx, w, h, h * 0.5, 180, '#9aa9b4', 0.3)
      hills(ctx, w, h, h * 0.56, 140, '#7d8a93', 1.4)
      hills(ctx, w, h, h * 0.64, 110, '#b9764a', 2.7)
      meadow(ctx, w, h, h * 0.74, ['#c1953f', '#9c7327'])
      figure(ctx, w * 0.5, h * 0.78, 1.0, '#3a2c22', 'stand')
      break
    case 'trail-forest':
      sky(ctx, w, h, ['#dcefd8', '#bfe0c4'])
      meadow(ctx, w, h, h * 0.42, ['#b7913c', '#8f6c26'])
      for (let i = 0; i < 7; i++) tree(ctx, w * (0.08 + i * 0.14), h * (0.42 + (i % 2) * 0.05), 1.1 + (i % 3) * 0.25, autumnTree(i))
      break
    case 'trail-meadow':
      sky(ctx, w, h, ['#d6ecf6', '#bcd9e8'])
      hills(ctx, w, h, h * 0.5, 120, '#b9844f', 0.6)
      meadow(ctx, w, h, h * 0.58, ['#cda24a', '#a87f2c'])
      tree(ctx, w * 0.16, h * 0.55, 1.2, ['#c8772e', '#d89234', '#b85f22'])
      blanket(ctx, w * 0.52, h * 0.85)
      break
    case 'trail-night':
    default:
      sky(ctx, w, h, ['#16203f', '#2a2950', '#3c2f4e'])
      stars(ctx, w, h * 0.6)
      sun(ctx, w * 0.76, h * 0.16, 46, '#f6f2d8', 0.35)
      hills(ctx, w, h, h * 0.66, 150, '#241a2e', 0.9)
      hills(ctx, w, h, h * 0.66, 100, '#191222', 2.4)
      meadow(ctx, w, h, h * 0.74, ['#3a2c1c', '#241a12'])
      campfire(ctx, w * 0.5, h * 0.84)
      figure(ctx, w * 0.36, h * 0.83, 0.9, '#0c1020', 'sit')
      figure(ctx, w * 0.64, h * 0.83, 0.9, '#0c1020', 'sit')
      break
  }
  vignette(ctx, w, h)
}

function autumnTree(i) {
  const palettes = [
    ['#c8772e', '#d89234', '#b85f22'],
    ['#b8862e', '#d0a83a', '#9c6f24'],
    ['#b04e2e', '#c86a34', '#8e3f22'],
  ]
  return palettes[i % palettes.length]
}

// ---- primitives --------------------------------------------------------------

function sky(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function sun(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
  g.addColorStop(0, color)
  g.addColorStop(0.5, hexA(color, (alpha ?? 0.6) * 0.5))
  g.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function hills(ctx, w, h, baseY, amp, color, phase) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, baseY)
  for (let x = 0; x <= w; x += 8) {
    const t = x / w
    const y =
      baseY - amp * (0.55 + 0.45 * Math.sin(t * Math.PI * 2 * 1.1 + phase)) * (0.7 + 0.3 * Math.sin(x * 0.004 + phase))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

function lake(ctx, w, h, top, colors, bottom) {
  const b = bottom ?? h
  const g = ctx.createLinearGradient(0, top, 0, b)
  g.addColorStop(0, colors[0])
  g.addColorStop(1, colors[1])
  ctx.fillStyle = g
  ctx.fillRect(0, top, w, b - top)
}

function sunReflection(ctx, x, top, h, width, color) {
  const g = ctx.createLinearGradient(0, top, 0, h)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - width / 2, top, width, h - top)
}

function ripples(ctx, w, top, h) {
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 3
  for (let i = 0; i < 7; i++) {
    const y = top + ((h - top) * (i + 1)) / 9
    ctx.beginPath()
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 4)
    ctx.stroke()
  }
}

function meadow(ctx, w, h, top, colors) {
  const g = ctx.createLinearGradient(0, top, 0, h)
  g.addColorStop(0, colors[0])
  g.addColorStop(1, colors[1])
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, top + 18)
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, top + 18 + Math.sin(x * 0.02) * 8)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
}

function buildings(ctx, w, horizonY, opts = {}) {
  const { color = '#2b3550', lit = false, windows = false, offset = 0 } = opts
  let x = -offset
  let i = offset ? 3 : 0
  while (x < w) {
    const bw = 64 + ((i * 53) % 78)
    const bh = 120 + ((i * 97) % 280)
    const top = horizonY - bh
    ctx.fillStyle = color
    ctx.fillRect(x, top, bw - 6, bh)
    if (lit || windows) {
      for (let wy = top + 14; wy < horizonY - 12; wy += 24)
        for (let wx = x + 9; wx < x + bw - 16; wx += 19) {
          const on = lit ? (wx + wy + i) % 3 === 0 : false
          ctx.fillStyle = on ? 'rgba(255,221,130,0.92)' : 'rgba(255,255,255,0.12)'
          ctx.fillRect(wx, wy, 8, 11)
        }
    }
    x += bw
    i++
  }
}

function street(ctx, w, h, top, color) {
  ctx.fillStyle = color
  ctx.fillRect(0, top, w, h - top)
}

function road(ctx, w, h, top) {
  ctx.fillStyle = '#3a3f47'
  ctx.fillRect(0, top, w, h - top)
  ctx.fillStyle = '#8c97a5'
  ctx.fillRect(0, top, w, 6)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 7
  ctx.setLineDash([26, 26])
  ctx.beginPath()
  ctx.moveTo(w / 2, top)
  ctx.lineTo(w / 2, h)
  ctx.stroke()
  ctx.setLineDash([])
}

function cars(ctx, w, y) {
  const car = (x, col) => {
    ctx.fillStyle = col
    roundRect(ctx, x, y, 96, 42, 10)
    roundRect(ctx, x + 18, y - 24, 60, 30, 8)
    ctx.fillStyle = '#11141c'
    ctx.beginPath()
    ctx.arc(x + 22, y + 42, 13, 0, Math.PI * 2)
    ctx.arc(x + 74, y + 42, 13, 0, Math.PI * 2)
    ctx.fill()
  }
  car(w * 0.18, '#d94a4a')
  car(w * 0.62, '#3f7fd0')
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.fill()
}

function dock(ctx, w, h, waterTop, side) {
  const cx = side === 'left' ? w * 0.34 : w * 0.5
  const topW = 60
  const botW = 230
  const topY = waterTop + 6
  const botY = h
  ctx.fillStyle = '#7c5a3a'
  ctx.beginPath()
  ctx.moveTo(cx - topW / 2, topY)
  ctx.lineTo(cx + topW / 2, topY)
  ctx.lineTo(cx + botW / 2, botY)
  ctx.lineTo(cx - botW / 2, botY)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 4
  for (let i = 1; i < 6; i++) {
    const f = i / 6
    const y = topY + (botY - topY) * f
    const hw = (topW + (botW - topW) * f) / 2
    ctx.beginPath()
    ctx.moveTo(cx - hw, y)
    ctx.lineTo(cx + hw, y)
    ctx.stroke()
  }
}

function canoe(ctx, x, y, s) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = '#b8521f'
  ctx.beginPath()
  ctx.moveTo(-170, 0)
  ctx.quadraticCurveTo(0, 70, 170, 0)
  ctx.quadraticCurveTo(0, 30, -170, 0)
  ctx.fill()
  ctx.fillStyle = '#e2873f'
  ctx.beginPath()
  ctx.moveTo(-170, 0)
  ctx.quadraticCurveTo(0, 30, 170, 0)
  ctx.quadraticCurveTo(0, 12, -170, 0)
  ctx.fill()
  figure(ctx, -55, -10, 0.7, '#2b3a4a', 'sit')
  figure(ctx, 60, -10, 0.7, '#39506a', 'sit')
  ctx.strokeStyle = '#6b4a2c'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(90, -50)
  ctx.lineTo(135, 40)
  ctx.stroke()
  ctx.restore()
}

function blanket(ctx, x, y) {
  ctx.save()
  ctx.translate(x, y)
  ctx.transform(1, 0, -0.5, 0.42, 0, 0)
  const size = 360
  const cells = 6
  const step = size / cells
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#e8615f' : '#f6e7d2'
      ctx.fillRect(-size / 2 + i * step, -size / 2 + j * step, step, step)
    }
  ctx.restore()
  ctx.fillStyle = '#a9712f'
  ctx.fillRect(x + 60, y - 36, 70, 44)
  ctx.fillStyle = '#8a5a22'
  ctx.fillRect(x + 60, y - 36, 70, 10)
}

function tree(ctx, x, y, s, greens) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = '#5b3b22'
  ctx.fillRect(-9, 0, 18, 70)
  const cols = greens || ['#3f7a45', '#4c8c50', '#5a9d5c']
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = cols[i]
    const ty = -i * 46
    const tw = 78 - i * 16
    ctx.beginPath()
    ctx.moveTo(0, ty - 70)
    ctx.lineTo(-tw, ty + 10)
    ctx.lineTo(tw, ty + 10)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function figure(ctx, x, y, s, color, pose) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, -70, 22, 0, Math.PI * 2)
  ctx.fill()
  if (pose === 'jump') {
    ctx.lineWidth = 20
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    line(ctx, 0, -50, 0, 0)
    line(ctx, 0, -38, -42, -60)
    line(ctx, 0, -38, 40, -64)
    line(ctx, 0, 0, -34, 46)
    line(ctx, 0, 0, 38, 40)
  } else if (pose === 'sit') {
    ctx.beginPath()
    ctx.moveTo(-26, 18)
    ctx.quadraticCurveTo(0, -54, 26, 18)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(-22, 40)
    ctx.quadraticCurveTo(0, -58, 22, 40)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function splash(ctx, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI - Math.PI / 2
    const r = 30 + (i % 3) * 12
    ctx.beginPath()
    ctx.ellipse(x + Math.cos(a) * r, y - Math.abs(Math.sin(a)) * 36, 7, 16, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 52, 14, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fill()
}

function campfire(ctx, x, y) {
  ctx.strokeStyle = '#6b4326'
  ctx.lineWidth = 16
  ctx.lineCap = 'round'
  line(ctx, x - 46, y + 18, x + 46, y + 6)
  line(ctx, x - 46, y + 6, x + 46, y + 18)
  const g = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 220)
  g.addColorStop(0, 'rgba(255,170,60,0.55)')
  g.addColorStop(1, 'rgba(255,170,60,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y - 30, 220, 0, Math.PI * 2)
  ctx.fill()
  flame(ctx, x, y, 70, '#ff7a1a')
  flame(ctx, x, y, 48, '#ffb43a')
  flame(ctx, x, y, 26, '#ffe27a')
}

function flame(ctx, x, y, hgt, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - hgt)
  ctx.quadraticCurveTo(x + hgt * 0.5, y - hgt * 0.4, x + hgt * 0.28, y)
  ctx.quadraticCurveTo(x, y + 8, x - hgt * 0.28, y)
  ctx.quadraticCurveTo(x - hgt * 0.5, y - hgt * 0.4, x, y - hgt)
  ctx.fill()
}

function stars(ctx, w, maxY) {
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 90; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1
    const y = (Math.sin(i * 78.233) * 12543.123) % 1
    const px = Math.abs(x) * w
    const py = Math.abs(y) * maxY
    const r = Math.abs(Math.sin(i)) * 1.6 + 0.4
    ctx.globalAlpha = 0.5 + Math.abs(Math.cos(i)) * 0.5
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function hexA(hex, a) {
  const m = hex.replace('#', '')
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
