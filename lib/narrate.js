// Shared narration core (ESM) used by the local server (server/index.js) and
// the Vercel function (api/narrate.js).
//
// Free, key-less natural voice via Microsoft Edge's neural "Read Aloud" voices
// (edge-tts). Translates the text to the requested language first (best-effort),
// then synthesizes mp3. Throws Errors carrying a `.code` so callers can map to
// an HTTP status.

import pkg from 'msedge-tts'
import Anthropic from '@anthropic-ai/sdk'

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

// Lazily-built Anthropic client. Returns null when no API key is configured so
// callers transparently fall back to the keyless Google path. Honors
// ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL from the environment.
let _anthropic
function anthropicClient() {
  if (_anthropic !== undefined) return _anthropic
  _anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
  return _anthropic
}

// Natural, culturally-aware localization via Claude. The whole batch goes in one
// request so phrasing stays consistent and the model has the full story for
// context. Returns an array aligned with `texts`, or null when the LLM is
// unavailable or the response doesn't line up — so callers can fall back.
async function translateWithLLM(texts, target) {
  const client = anthropicClient()
  if (!client) return null
  const langName = LANG_NAMES[String(target).toLowerCase()] || target
  const model = process.env.TRANSLATE_MODEL || 'claude-opus-4-8'
  try {
    const res = await client.messages.create({
      model,
      max_tokens: 2000,
      system:
        `You are a literary localizer for a photo-book storytelling app. Render each ` +
        `English caption into ${langName} the way a native speaker would naturally say ` +
        `it — warm, idiomatic and culturally appropriate, never a word-for-word machine ` +
        `translation. Prefer everyday, conversational vocabulary over rare or overly ` +
        `formal terms. Preserve the meaning, tone and sentence count; keep proper nouns; ` +
        `add nothing and drop nothing. Return the translations in the same order.`,
      messages: [{ role: 'user', content: JSON.stringify({ texts }) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { translations: { type: 'array', items: { type: 'string' } } },
            required: ['translations'],
            additionalProperties: false,
          },
        },
      },
    })
    const block = res.content.find((b) => b.type === 'text')
    const parsed = block ? JSON.parse(block.text) : null
    const out = parsed && Array.isArray(parsed.translations) ? parsed.translations : null
    if (!out || out.length !== texts.length) return null
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
