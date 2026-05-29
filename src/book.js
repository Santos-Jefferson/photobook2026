// Helpers that turn an API response into the ordered list of story slides
// the viewer renders: opening -> one slide per photo -> closing.

// Accepts either a raw base64 string or a full data URL and returns something
// usable as an <img src>.
export function resolveImageSrc(b64) {
  if (!b64) return ''
  if (typeof b64 !== 'string') return ''
  if (b64.startsWith('data:')) return b64
  return `data:image/png;base64,${b64}`
}

// The server might wrap the payload (data/result/photobook/book) or return a
// JSON string. Unwrap to the object that actually has title/pages/opening.
export function normalizeBook(raw) {
  let book = raw
  if (typeof book === 'string') {
    try {
      book = JSON.parse(book)
    } catch {
      return { __unparsed: raw }
    }
  }
  if (book && typeof book === 'object') {
    for (const key of ['data', 'result', 'response', 'photobook', 'book']) {
      const inner = book[key]
      if (inner && typeof inner === 'object' && ('pages' in inner || 'opening' in inner)) {
        return inner
      }
    }
  }
  return book || {}
}

export function buildSlides(book) {
  const slides = []

  slides.push({
    type: 'opening',
    title: book.title,
    text: book.opening,
    vibe: book.vibe,
  })

  for (const p of book.pages || []) {
    slides.push({
      type: 'photo',
      page: p.page,
      narrative: p.narrative_beat,
      caption: p.caption,
      image: resolveImageSrc(p.styled_image_b64),
      styleApplied: p.style_applied,
    })
  }

  slides.push({
    type: 'closing',
    title: book.title,
    text: book.closing,
  })

  return slides
}
