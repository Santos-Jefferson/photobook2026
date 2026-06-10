import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serve the /api/* serverless endpoints during `npm run dev` too, so features
// that depend on them (narration, perspective, free-form rewrite → Bedtime mode,
// translation) work without a separate `npm run share` / Node server. Mirrors
// the routes in server/index.js, reusing the same lib/narrate.js core.
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      const readBody = (req) =>
        new Promise((resolve, reject) => {
          let d = ''
          req.on('data', (c) => {
            d += c
            if (d.length > 6_000_000) reject(new Error('body too large'))
          })
          req.on('end', () => {
            try {
              resolve(d ? JSON.parse(d) : {})
            } catch (e) {
              reject(e)
            }
          })
          req.on('error', reject)
        })
      const json = (res, code, obj) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (!path.startsWith('/api/')) return next()
        if (req.method !== 'POST') return next()

        let body
        try {
          body = await readBody(req)
        } catch {
          return json(res, 400, { error: 'Invalid JSON body' })
        }

        try {
          const { getNarrationAudio, translateMany, rewritePerspective, rewriteWithInstruction } = await import(
            './lib/narrate.js'
          )
          if (path === '/api/rewrite') {
            return json(res, 200, { texts: await rewriteWithInstruction(body.texts, body.instruction) })
          }
          if (path === '/api/perspective') {
            return json(res, 200, { texts: await rewritePerspective(body.texts, body.perspective) })
          }
          if (path === '/api/translate') {
            return json(res, 200, { texts: await translateMany(body.texts, body.target || 'en') })
          }
          if (path === '/api/narrate') {
            const audio = await getNarrationAudio({
              text: body.text,
              lang: body.lang,
              gender: body.gender,
              shouldTranslate: body.translate !== false,
            })
            res.statusCode = 200
            res.setHeader('Content-Type', 'audio/mpeg')
            return res.end(audio)
          }
          return next()
        } catch (e) {
          const status = e && e.code === 'NO_KEY' ? 501 : 500
          return json(res, status, { error: String((e && e.message) || e) })
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: {
    host: true,
    port: 5173,
  },
})
