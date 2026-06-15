// Demo-minimal "share link" store: takes the browser-rendered WebM story video,
// transcodes it to MP4 (H.264/AAC) with ffmpeg, keeps it in memory (pod-local,
// with a TTL), and serves a small public story page + the MP4 + a poster frame.
//
// Used by both the Node server (server/index.js) and the Vite dev middleware.
// Not durable across restarts — fine for a demo; swap the Map for S3 later.

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, readFile, unlink } from 'node:fs/promises'

const TTL_MS = 6 * 60 * 60 * 1000 // 6h
const store = new Map() // id -> { mp4, poster, title, createdAt }

function sweep() {
  const now = Date.now()
  for (const [id, v] of store) if (now - v.createdAt > TTL_MS) store.delete(id)
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args)
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject) // e.g. ffmpeg not installed
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${code}: ${err.slice(-400)}`))))
  })
}

// Transcode WebM -> MP4 and grab a poster JPEG. File-based so faststart works.
async function transcode(webm) {
  const base = join(tmpdir(), 'pb-' + randomBytes(6).toString('hex'))
  const inPath = base + '.webm'
  const mp4Path = base + '.mp4'
  const jpgPath = base + '.jpg'
  await writeFile(inPath, webm)
  try {
    await run('ffmpeg', [
      '-y', '-i', inPath,
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k',
      mp4Path,
    ])
    await run('ffmpeg', ['-y', '-i', mp4Path, '-ss', '00:00:01', '-vframes', '1', jpgPath]).catch(() => {})
    const mp4 = await readFile(mp4Path)
    let poster = null
    try {
      poster = await readFile(jpgPath)
    } catch {
      /* no poster — fine */
    }
    return { mp4, poster }
  } finally {
    unlink(inPath).catch(() => {})
    unlink(mp4Path).catch(() => {})
    unlink(jpgPath).catch(() => {})
  }
}

// Store a rendered WebM as a shareable MP4. Returns the share id.
export async function putShare(webmBuffer, title) {
  sweep()
  const { mp4, poster } = await transcode(webmBuffer)
  const id = randomBytes(8).toString('hex')
  store.set(id, { mp4, poster, title: title || 'Our Story', createdAt: Date.now() })
  return id
}

export function getShare(id) {
  const v = store.get(id)
  if (!v) return null
  if (Date.now() - v.createdAt > TTL_MS) {
    store.delete(id)
    return null
  }
  return v
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// The public story page: a rich link preview (OG/Twitter tags so WhatsApp shows a
// thumbnail) + the video + "Share to Instagram" (native share of the MP4) +
// download. Instagram can't be posted from a link, so we hand over the MP4.
export function storyPageHtml(id, origin) {
  const v = getShare(id)
  const title = v ? v.title : 'Photobook'
  const page = `${origin}/s/${id}`
  const mp4 = `${origin}/s/${id}.mp4`
  const jpg = `${origin}/s/${id}.jpg`
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Photobook</title>
<meta property="og:type" content="video.other">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="A little photo story 📖">
<meta property="og:url" content="${page}">
<meta property="og:image" content="${jpg}">
<meta property="og:video" content="${mp4}">
<meta property="og:video:type" content="video/mp4">
<meta name="twitter:card" content="player">
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0c1118;color:#fff;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:18px;box-sizing:border-box}
  h1{font-size:19px;font-weight:800;margin:0;text-align:center}
  video{width:100%;max-width:420px;border-radius:16px;background:#000;box-shadow:0 18px 50px rgba(0,0,0,.5)}
  .row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;max-width:420px;width:100%}
  a.btn,button.btn{flex:1;min-width:140px;text-align:center;text-decoration:none;border:none;cursor:pointer;
       font:inherit;font-weight:700;font-size:15px;padding:13px 16px;border-radius:14px;color:#fff}
  .ig{background:linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)}
  .dl{background:#1f2a36}
  .wa{background:#25d366;color:#063}
  .note{color:#8b97a6;font-size:12px;text-align:center;max-width:420px}
</style></head><body>
  <h1>${esc(title)}</h1>
  <video src="${mp4}" poster="${jpg}" controls playsinline></video>
  <div class="row">
    <button class="btn ig" onclick="shareIG()">📸 Share to Instagram</button>
    <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(title + ' — ' + page)}" target="_blank" rel="noopener">🟢 WhatsApp</a>
    <a class="btn dl" href="${mp4}" download="${esc(title)}.mp4">⬇ Download MP4</a>
  </div>
  <p class="note">Instagram can't post from a link — tap “Share to Instagram”, pick Instagram, and post it to your Story.</p>
<script>
  async function shareIG(){
    try{
      const r=await fetch(${JSON.stringify(mp4)});const b=await r.blob();
      const f=new File([b],${JSON.stringify(esc(title))}+'.mp4',{type:'video/mp4'});
      if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:${JSON.stringify(esc(title))}});return;}
    }catch(e){}
    location.href=${JSON.stringify(mp4)};
  }
</script>
</body></html>`
}
