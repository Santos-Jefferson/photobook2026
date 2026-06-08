// Retell a story's visible text from a chosen narrator perspective via
// /api/perspective. Best-effort: on any failure the original book is returned
// unchanged. `ai` (neutral storyteller) is a no-op.

const ENDPOINT = '/api/perspective'

async function rewriteTexts(texts, perspective) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, perspective }),
  })
  if (!res.ok) throw new Error('perspective ' + res.status)
  const data = await res.json()
  return Array.isArray(data.texts) ? data.texts : texts
}

// Returns a new book with opening/closing and each page's caption + narrative
// retold in `perspective`. The title is left as-is. Falls back to the original
// book on any failure.
export async function rewriteBookPerspective(book, perspective) {
  if (!book || typeof book !== 'object' || !perspective || perspective === 'ai') return book
  const pages = Array.isArray(book.pages) ? book.pages : []
  const out = { ...book, pages: pages.map((p) => ({ ...p })) }

  const texts = []
  const apply = [] // setter for each collected text, in order
  const collect = (val, set) => {
    texts.push(val || '')
    apply.push(set)
  }

  collect(book.opening, (v) => (out.opening = v))
  collect(book.closing, (v) => (out.closing = v))
  out.pages.forEach((p, i) => {
    collect(p.caption, (v) => (out.pages[i].caption = v))
    collect(p.narrative_beat, (v) => (out.pages[i].narrative_beat = v))
  })

  try {
    const rewritten = await rewriteTexts(texts, perspective)
    rewritten.forEach((t, i) => apply[i] && apply[i](t || texts[i]))
    return out
  } catch {
    return book
  }
}
