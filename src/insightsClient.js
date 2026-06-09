// Analyze a small set of album photos to (a) auto-suggest a title + context and
// (b) surface a few "what we noticed" insights — themes, mood, a highlight, and
// an approximate people/smiles note. Uses only existing endpoints:
//   • /photo-chat/ask  — per-photo vision Q&A (a short description each)
//   • /api/rewrite      — LLM synthesis of the labeled summary
// Best-effort: any failure returns null so the create flow is never blocked.

import { askPhoto } from './photoChat'
import { rewriteTexts } from './memoryClient'

const MAX_ANALYZE = 5

const DESCRIBE_Q =
  'In one short sentence, describe this photo: the setting or activity, the overall mood, ' +
  'and how many people are visible and how many look like they are smiling.'

// Pull a free-text answer out of whatever shape /photo-chat/ask returns.
function answerOf(r) {
  return (r && (r.answer || r.text_response || r.response || r.text || r.message)) || ''
}

export async function analyzeAlbum(photoUrls) {
  const urls = (photoUrls || []).slice(0, MAX_ANALYZE)
  if (!urls.length) return null

  // Phase A — a short vision description per photo (in parallel).
  const descriptions = await Promise.all(
    urls.map(async (u, i) => {
      try {
        const r = await askPhoto({ photo: u, question: DESCRIBE_Q })
        const a = answerOf(r).trim()
        return a ? `Photo ${i + 1}: ${a}` : ''
      } catch {
        return ''
      }
    }),
  )
  const notes = descriptions.filter(Boolean).join('\n')
  if (!notes) return null

  // Phase B — synthesize a single labeled summary from the notes.
  const instruction =
    'You are given short notes about each photo in a personal album:\n' +
    notes +
    '\n\nReply with exactly these labeled lines and nothing else:\n' +
    'Title: a short, evocative album title (max 6 words)\n' +
    'Context: a warm 1-2 sentence description of the album\n' +
    'Themes: 2 to 4 short theme tags separated by commas (e.g. family, travel, food)\n' +
    'Mood: the overall mood in 1 to 3 words\n' +
    'Highlight: one sentence naming the standout moment\n' +
    'People: one short sentence about who appears and how much smiling there is'

  let summary = ''
  try {
    const [res] = await rewriteTexts([notes], instruction)
    summary = res || ''
  } catch {
    return null
  }
  return parseLabeled(summary)
}

function parseLabeled(text) {
  const get = (label) => {
    const m = String(text || '').match(new RegExp('^\\s*' + label + '\\s*:\\s*(.+)$', 'im'))
    return m ? m[1].trim() : ''
  }
  const themesRaw = get('Themes')
  const out = {
    title: get('Title'),
    context: get('Context'),
    themes: themesRaw
      ? themesRaw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    mood: get('Mood'),
    highlight: get('Highlight'),
    people: get('People'),
  }
  // Nothing parsed at all → treat as no insight.
  if (!out.title && !out.context && !out.themes.length && !out.mood && !out.highlight && !out.people) {
    return null
  }
  return out
}
