// Local all-in-one server (ESM): serves the built app (dist/) AND the
// /api/narrate endpoint, so you can run everything on your machine and expose
// it with a tunnel (e.g. `cloudflared tunnel --url http://localhost:5050`).
// Your ElevenLabs key stays local — read from .env.local or the environment.
//
//   npm run share     # build + start this server
//   node server/index.js
//
// No framework: uses Node's built-in http so there's nothing to install.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setGlobalDispatcher, ProxyAgent } from 'undici'
import { getNarrationAudio, translateMany, rewritePerspective, rewriteWithInstruction } from '../lib/narrate.js'
import { putShare, getShare, storyPageHtml } from '../lib/shareStore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read a raw (binary) request body — used for the uploaded share video.
function readRawBody(req, max = 80_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let len = 0
    req.on('data', (c) => {
      len += c.length
      if (len > max) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function originOf(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http'
  return proto + '://' + (req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
}

// --- tiny .env.local loader (so we don't need dotenv) ---
function loadEnvLocal() {
  const file = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvLocal()

// On a corporate network, Node's fetch (unlike the browser) won't use the
// system proxy — outbound calls to ElevenLabs/translation fail with "fetch
// failed". If a proxy is configured, route all fetches through it.
const PROXY =
  process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
if (PROXY) {
  try {
    setGlobalDispatcher(new ProxyAgent(PROXY))
  } catch (e) {
    console.warn('  Proxy setup failed:', e.message)
  }
}

const DIST = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 5050

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 5_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')

  // --- health check (for k8s liveness/readiness probes) ---
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // --- narration API ---
  if (url.pathname === '/api/narrate') {
    if (req.method !== 'POST') {
      res.writeHead(405).end('Method not allowed')
      return
    }
    try {
      const body = await readJsonBody(req)
      const audio = await getNarrationAudio({
        text: body.text,
        lang: body.lang,
        gender: body.gender,
        shouldTranslate: body.translate !== false,
      })
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' })
      res.end(audio)
    } catch (e) {
      const status = e.code === 'NO_KEY' ? 501 : e.code === 'NO_TEXT' ? 400 : 502
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message, detail: e.detail }))
    }
    return
  }

  // --- translation API (batch) ---
  if (url.pathname === '/api/translate') {
    if (req.method !== 'POST') {
      res.writeHead(405).end('Method not allowed')
      return
    }
    try {
      const body = await readJsonBody(req)
      const texts = await translateMany(body.texts, body.target || 'en')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ texts }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }))
    }
    return
  }

  // --- narrator perspective rewrite (batch) ---
  if (url.pathname === '/api/perspective') {
    if (req.method !== 'POST') {
      res.writeHead(405).end('Method not allowed')
      return
    }
    try {
      const body = await readJsonBody(req)
      const texts = await rewritePerspective(body.texts, body.perspective)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ texts }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }))
    }
    return
  }

  // --- free-form text rewrite (batch) — powers the Photo Chat memory actions ---
  if (url.pathname === '/api/rewrite') {
    if (req.method !== 'POST') {
      res.writeHead(405).end('Method not allowed')
      return
    }
    try {
      const body = await readJsonBody(req)
      const texts = await rewriteWithInstruction(body.texts, body.instruction)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ texts }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }))
    }
    return
  }

  // --- share: upload a rendered video, get a hosted MP4 + story page ---
  if (url.pathname === '/api/share' && req.method === 'POST') {
    try {
      const buf = await readRawBody(req)
      const id = await putShare(buf, url.searchParams.get('title') || 'Our Story')
      const origin = originOf(req)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id, pageUrl: `${origin}/s/${id}`, mp4Url: `${origin}/s/${id}.mp4` }))
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      const status = /ENOENT|ffmpeg/.test(msg) ? 501 : 500
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: msg }))
    }
    return
  }
  // --- public story page + media (/s/:id, /s/:id.mp4, /s/:id.jpg) ---
  if (url.pathname.startsWith('/s/')) {
    const rest = url.pathname.slice(3)
    const mp4 = rest.endsWith('.mp4')
    const jpg = rest.endsWith('.jpg')
    const id = rest.replace(/\.(mp4|jpg)$/, '')
    const rec = getShare(id)
    if (!rec) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('This share link has expired.')
      return
    }
    if (mp4) {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'public, max-age=3600' })
      res.end(rec.mp4)
    } else if (jpg) {
      if (!rec.poster) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' })
      res.end(rec.poster)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(storyPageHtml(id, originOf(req)))
    }
    return
  }

  // --- static files (SPA) ---
  if (!fs.existsSync(DIST)) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('dist/ not found — run `npm run build` first (or use `npm run share`).')
    return
  }

  // Resolve within DIST, guard against path traversal.
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  const candidate = path.join(DIST, rel)
  if (candidate.startsWith(DIST) && rel && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    sendFile(res, candidate)
  } else {
    sendFile(res, path.join(DIST, 'index.html')) // SPA fallback
  }
})

server.listen(PORT, () => {
  console.log(`\n  Photobook running at  http://localhost:${PORT}`)
  console.log(`  Narration voice:      Microsoft Edge neural voices (free, no key)`)
  console.log(`  Outbound proxy:       ${PROXY || 'none (direct)'}`)
  console.log(`\n  Share it publicly:    cloudflared tunnel --url http://localhost:${PORT}\n`)
})
