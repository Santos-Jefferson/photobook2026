// Shared narration core (plain Node, ESM) used by both the local server
// (server/index.js) and the Vercel function (api/narrate.js).
//
// Translates the text to the requested language (best-effort) and synthesizes a
// natural human voice with ElevenLabs. Throws Errors carrying a `.code` so the
// caller can map to an HTTP status.

const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM' // ElevenLabs "Rachel" (warm, natural)

function voiceForLang(lang, env) {
  const perLang = env['ELEVENLABS_VOICE_ID_' + String(lang || '').toUpperCase()]
  return perLang || env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE
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

export async function getNarrationAudio({ text, lang = 'en', shouldTranslate = true, env = process.env }) {
  const key = env.ELEVENLABS_API_KEY
  if (!key) {
    const e = new Error('TTS not configured (missing ELEVENLABS_API_KEY)')
    e.code = 'NO_KEY'
    throw e
  }
  const clean = (text || '').toString().slice(0, 2500)
  if (!clean.trim()) {
    const e = new Error('Missing text')
    e.code = 'NO_TEXT'
    throw e
  }

  const finalText = shouldTranslate ? await translateText(clean, lang) : clean
  const voiceId = voiceForLang(lang, env)

  const r = await fetch(
    'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128',
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: finalText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
      }),
    },
  )

  if (!r.ok) {
    let detail = ''
    try {
      detail = await r.text()
    } catch {
      /* ignore */
    }
    const e = new Error('ElevenLabs error ' + r.status)
    e.code = 'TTS_ERR'
    e.detail = detail.slice(0, 300)
    throw e
  }

  return Buffer.from(await r.arrayBuffer())
}
