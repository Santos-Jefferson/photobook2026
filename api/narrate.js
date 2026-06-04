// Vercel serverless function: turn story text into a natural human voice.
//
// Flow: (1) translate the text into the requested language (best-effort), then
// (2) synthesize speech with ElevenLabs' multilingual model. The API key stays
// server-side (never shipped to the browser).
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   ELEVENLABS_API_KEY        (required) your ElevenLabs key
//   ELEVENLABS_VOICE_ID       (optional) default voice id
//   ELEVENLABS_VOICE_ID_EN/PT/ES (optional) per-language voice override
//
// Returns: audio/mpeg (mp3) on success; JSON error otherwise.

const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM' // ElevenLabs "Rachel" (warm, natural)

function voiceForLang(lang) {
  const perLang = process.env['ELEVENLABS_VOICE_ID_' + String(lang || '').toUpperCase()]
  return perLang || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE
}

// Best-effort translation via the public Google endpoint (no key). Falls back
// to the original text on any failure — narration should never hard-fail here.
async function translate(text, target) {
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

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    // Signals the client to fall back to the browser voice.
    res.status(501).json({ error: 'TTS not configured (missing ELEVENLABS_API_KEY)' })
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  const rawText = (body.text || '').toString().slice(0, 2500)
  const lang = (body.lang || 'en').toString()
  if (!rawText.trim()) {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  const text = body.translate === false ? rawText : await translate(rawText, lang)

  try {
    const voiceId = voiceForLang(lang)
    const r = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
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
      res.status(502).json({ error: 'ElevenLabs error ' + r.status, detail: detail.slice(0, 300) })
      return
    }

    const audio = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(audio)
  } catch (e) {
    res.status(500).json({ error: 'TTS failed', detail: String(e && e.message ? e.message : e) })
  }
}
