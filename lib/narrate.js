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
}

function voiceForLang(lang, env) {
  const code = String(lang || 'en').toLowerCase()
  return env['EDGE_VOICE_' + code.toUpperCase()] || env.EDGE_VOICE || VOICES[code] || VOICES.en
}

// Best-effort translation via the public Google endpoint (no key). Falls back
// to the original text on any failure.
export async function translateText(text, target) {
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

// Translate an array of strings (best-effort, each falls back to its original).
export async function translateMany(texts, target) {
  return Promise.all((Array.isArray(texts) ? texts : []).map((t) => translateText(t, target)))
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
