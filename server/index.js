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
import { getNarrationAudio } from '../lib/narrate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  const hasKey = !!process.env.ELEVENLABS_API_KEY
  console.log(`\n  Photobook running at  http://localhost:${PORT}`)
  console.log(
    `  Narration voice:      ${
      hasKey ? 'ElevenLabs (configured ✓)' : 'browser fallback (set ELEVENLABS_API_KEY in .env.local)'
    }`,
  )
  console.log(`  Outbound proxy:       ${PROXY || 'none (direct)'}`)
  console.log(`\n  Share it publicly:    cloudflared tunnel --url http://localhost:${PORT}\n`)
})
