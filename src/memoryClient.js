// Small client helpers for the Photo Chat "memory actions": free-form text
// rewrites (/api/rewrite, internal LLM) and translation (/api/translate). Both
// return an array aligned with the input; callers fall back to the originals.

async function postTexts(endpoint, body, texts) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(endpoint + ' ' + res.status)
  const data = await res.json()
  return Array.isArray(data.texts) ? data.texts : texts
}

export function rewriteTexts(texts, instruction) {
  return postTexts('/api/rewrite', { texts, instruction }, texts)
}

export function translateTexts(texts, target) {
  return postTexts('/api/translate', { texts, target }, texts)
}
