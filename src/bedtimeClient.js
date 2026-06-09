// Retell a generated story as a gentle bedtime story via the free-form text
// rewrite endpoint (/api/rewrite). Best-effort: on any failure (e.g. demo mode
// with no backend) the original book is returned unchanged.

import { rewriteTexts } from './memoryClient'

const BEDTIME_INSTRUCTION =
  'Rewrite this as a gentle bedtime story for a young child: simple, warm, soothing words, ' +
  'short cozy sentences, and a soft "once upon a time" feeling. Keep the same meaning and ' +
  'roughly the same length, and do not invent new facts.'

// Returns a new book with opening/closing and each page's caption + narrative
// retold in a soothing bedtime voice. The title is left as-is. Falls back to the
// original book on any failure.
export async function rewriteBookBedtime(book) {
  if (!book || typeof book !== 'object') return book
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
    const rewritten = await rewriteTexts(texts, BEDTIME_INSTRUCTION)
    rewritten.forEach((t, i) => apply[i] && apply[i](t || texts[i]))
    out.__bedtime = true
    return out
  } catch {
    return book
  }
}
