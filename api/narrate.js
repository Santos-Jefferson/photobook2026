// Vercel serverless wrapper around the shared narration core. (Kept so the app
// also works if deployed to Vercel; for local use see server/index.js.)

import { getNarrationAudio } from '../lib/narrate.js'

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const chunks = []
  for await (const c of req) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  let body
  try {
    body = await readBody(req)
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }
  try {
    const audio = await getNarrationAudio({
      text: body.text,
      lang: body.lang,
      gender: body.gender,
      shouldTranslate: body.translate !== false,
    })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(audio)
  } catch (e) {
    const status = e.code === 'NO_KEY' ? 501 : e.code === 'NO_TEXT' ? 400 : 502
    res.status(status).json({ error: e.message, detail: e.detail })
  }
}
