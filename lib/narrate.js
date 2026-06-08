// Shared narration core (ESM) used by the local server (server/index.js) and
// the Vercel function (api/narrate.js).
//
// Free, key-less natural voice via Microsoft Edge's neural "Read Aloud" voices
// (edge-tts). Translates the text to the requested language first (best-effort),
// then synthesizes mp3. Throws Errors carrying a `.code` so callers can map to
// an HTTP status.

import pkg from 'msedge-tts'

const { MsEdgeTTS, OUTPUT_FORMAT } = pkg

// Natural neural voices per language (overridable via env).
const VOICES = {
  en: 'en-US-AriaNeural',
  pt: 'pt-BR-FranciscaNeural',
  es: 'es-ES-ElviraNeural',
  ja: 'ja-JP-NanamiNeural',
  hi: 'hi-IN-SwaraNeural',
  ta: 'ta-IN-PallaviNeural',
  te: 'te-IN-ShrutiNeural',
  bn: 'bn-IN-TanishaaNeural',
  kn: 'kn-IN-SapnaNeural',
}

function voiceForLang(lang, env) {
  const code = String(lang || 'en').toLowerCase()
  return env['EDGE_VOICE_' + code.toUpperCase()] || env.EDGE_VOICE || VOICES[code] || VOICES.en
}

// Human-readable language names for the localization prompt, keyed by the same
// short codes the UI sends.
const LANG_NAMES = {
  en: 'English',
  pt: 'Brazilian Portuguese',
  es: 'Spanish',
  ja: 'Japanese',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  kn: 'Kannada',
}

// Internal, key-less LLM for natural localization — an OpenAI-compatible
// endpoint (Qwen3) reachable in-cluster. Overridable via env; falls back to
// Google when unreachable (e.g. local dev outside the corporate network).
const TRANSLATE_API_URL =
  process.env.TRANSLATE_API_URL ||
  'https://docinsights.use.eks.mcap.sip.dev.cloud.synchronoss.net/v1'
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'qwen3'

// Pull the {"translations": [...]} array out of a chat response, tolerating
// Qwen's <think> reasoning blocks, markdown code fences, and stray prose.
function parseTranslations(content, expectedLen) {
  let s = String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // drop reasoning if it leaks through
    .replace(/```(?:json)?/gi, '')
    .trim()
  let obj = null
  try {
    obj = JSON.parse(s)
  } catch {
    const m = s.match(/\{[\s\S]*\}/) // first {...} block
    if (m) {
      try {
        obj = JSON.parse(m[0])
      } catch {
        /* ignore */
      }
    }
  }
  const arr = obj && Array.isArray(obj.translations) ? obj.translations : null
  return arr && arr.length === expectedLen ? arr : null
}

// Natural, culturally-aware localization via the internal LLM. The whole batch
// goes in one request so phrasing stays consistent and the model has the full
// story for context. Returns an array aligned with `texts`, or null when the
// endpoint is unreachable or the response doesn't line up — so callers fall back.
async function translateWithLLM(texts, target) {
  const langName = LANG_NAMES[String(target).toLowerCase()] || target
  const system =
    `/no_think\n` +
    `You are a literary localizer for a photo-book storytelling app. Render each ` +
    `English caption into ${langName} the way a native speaker would naturally say ` +
    `it — warm, idiomatic and culturally appropriate, never a word-for-word machine ` +
    `translation. Prefer everyday, conversational vocabulary over rare or overly ` +
    `formal terms. Preserve the meaning, tone and sentence count; keep proper nouns; ` +
    `add nothing and drop nothing. Reply with ONLY a JSON object of the form ` +
    `{"translations": ["...", "..."]} — one entry per input, in the same order, and no other text.`
  try {
    const res = await fetch(TRANSLATE_API_URL.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ texts }) },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    const out = parseTranslations(content, texts.length)
    if (!out) return null
    // Guard against any empty cell slipping through.
    return out.map((t, i) => (typeof t === 'string' && t.trim() ? t : texts[i]))
  } catch {
    return null
  }
}

// Keyless word-level translation via the public Google endpoint. Falls back to
// the original text on any failure.
async function googleTranslate(text, target) {
  if (!text || !target) return text
  try {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
      encodeURIComponent(target) +
      '&dt=t&q=' +
      encodeURIComponent(text)
    const r = await fetch(url)
    if (!r.ok) return text
    const data = await r.json()
    const segments = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : []
    const out = segments.map((s) => (s && s[0]) || '').join('')
    return out || text
  } catch {
    return text
  }
}

// Translate an array of strings. Prefers natural LLM localization; falls back to
// the keyless Google path (per-string) when the LLM isn't configured.
export async function translateMany(texts, target) {
  const arr = Array.isArray(texts) ? texts : []
  if (!arr.length) return []
  const llm = await translateWithLLM(arr, target)
  if (llm) return llm
  return Promise.all(arr.map((t) => googleTranslate(t, target)))
}

// Translate a single string (best-effort, falls back to the original).
export async function translateText(text, target) {
  if (!text || !target) return text
  const [out] = await translateMany([text], target)
  return out ?? text
}

export async function getNarrationAudio({ text, lang = 'en', shouldTranslate = true, env = process.env }) {
  const clean = (text || '').toString().slice(0, 3000)
  if (!clean.trim()) {
    const e = new Error('Missing text')
    e.code = 'NO_TEXT'
    throw e
  }

  const finalText = shouldTranslate ? await translateText(clean, lang) : clean
  const voice = voiceForLang(lang, env)

  try {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = tts.toStream(finalText)

    const audio = await new Promise((resolve, reject) => {
      const chunks = []
      const timer = setTimeout(() => reject(new Error('TTS timeout')), 20000)
      audioStream.on('data', (c) => chunks.push(c))
      audioStream.on('end', () => {
        clearTimeout(timer)
        resolve(Buffer.concat(chunks))
      })
      audioStream.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })

    if (!audio.length) throw new Error('empty audio')
    return audio
  } catch (err) {
    const e = new Error('TTS failed (edge-tts): ' + (err && err.message ? err.message : err))
    e.code = 'TTS_ERR'
    throw e
  }
}
