// Vercel serverless wrapper for the free-form text rewrite (shared core).

import { rewriteWithInstruction } from '../lib/narrate.js'

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
    const texts = await rewriteWithInstruction(body.texts, body.instruction)
    res.status(200).json({ texts })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) })
  }
}
