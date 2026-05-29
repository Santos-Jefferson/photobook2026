// Helpers that turn an API response into the ordered list of story slides
// the viewer renders: opening -> one slide per photo -> closing.

// Detect if text appears truncated (ends with space, incomplete sentence, etc.)
function isTruncated(text) {
  if (!text || typeof text !== 'string') return false
  // Text ending with space or trailing punctuation without closure suggests truncation
  if (text.endsWith(' ') || text.endsWith('  ')) return true
  // Sentence fragments ending with incomplete words
  if (text.match(/\s+[a-z]\.?$/) || text.endsWith('or ') || text.endsWith('the ') || text.endsWith('a ')) return true
  return false
}

// Validate base64 string (should have meaningful length and proper structure)
function isValidBase64(b64) {
  if (!b64 || typeof b64 !== 'string') return false
  // Valid base64 should be longer than trivial length and contain typical PNG header or consistent padding
  if (b64.length < 20) return false
  // PNG base64 should start with 'iVBORw0KGgo' - if truncated we'll see 'iVBORw0' or 'iVBOR'
  if (b64.startsWith('iVBOR') && !b64.startsWith('iVBORw0KGgo')) return false
  return true
}

// Accepts either a raw base64 string or a full data URL and returns something
// usable as an <img src>.
export function resolveImageSrc(b64) {
  if (!b64) return ''
  if (typeof b64 !== 'string') return ''
  if (b64.startsWith('data:')) return b64
  if (!isValidBase64(b64)) return '' // Return empty if base64 appears truncated/invalid
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
        // Check for truncation issues in key fields
        const warnings = []
        if (isTruncated(inner.opening)) warnings.push('opening text appears truncated')
        if (isTruncated(inner.closing)) warnings.push('closing text appears truncated')
        for (const p of inner.pages || []) {
          if (isTruncated(p.narrative_beat)) warnings.push(`page ${p.page} narrative appears truncated`)
          if (p.styled_image_b64 && !isValidBase64(p.styled_image_b64)) warnings.push(`page ${p.page} image appears truncated`)
        }
        if (warnings.length > 0) {
          inner.__truncationWarnings = warnings
        }
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
