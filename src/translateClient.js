// Translate a story's visible text to a target language via /api/translate.
// Best-effort: on any failure the original book is returned unchanged.

const ENDPOINT = '/api/translate'

async function translateTexts(texts, target) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, target }),
  })
  if (!res.ok) throw new Error('translate ' + res.status)
  const data = await res.json()
  return Array.isArray(data.texts) ? data.texts : texts
}

// Returns a new book with title/opening/closing and each page's caption +
// narrative translated to `target`. Other fields are left as-is.
export async function translateBook(book, target) {
  if (!book || typeof book !== 'object' || !target) return book
  const pages = Array.isArray(book.pages) ? book.pages : []
  const out = { ...book, pages: pages.map((p) => ({ ...p })) }

  const texts = []
  const apply = [] // setter for each collected text, in order
  const collect = (val, set) => {
    texts.push(val || '')
    apply.push(set)
  }

  collect(book.title, (v) => (out.title = v))
  collect(book.opening, (v) => (out.opening = v))
  collect(book.closing, (v) => (out.closing = v))
  out.pages.forEach((p, i) => {
    collect(p.caption, (v) => (out.pages[i].caption = v))
    collect(p.narrative_beat, (v) => (out.pages[i].narrative_beat = v))
  })

  const translated = await translateTexts(texts, target)
  translated.forEach((t, i) => apply[i] && apply[i](t || texts[i]))
  return out
}
