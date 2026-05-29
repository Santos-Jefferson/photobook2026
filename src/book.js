// Helpers that turn an API response into the ordered list of story slides
// the viewer renders: opening -> one slide per photo -> closing.

// Accepts either a raw base64 string or a full data URL and returns something
// usable as an <img src>.
export function resolveImageSrc(b64) {
  if (!b64) return ''
  if (b64.startsWith('data:')) return b64
  return `data:image/png;base64,${b64}`
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
