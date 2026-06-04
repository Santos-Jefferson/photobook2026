# 📖 Photobook

Turn a handful of photos from your library into a **swipeable, narrated photo book** — like Instagram Stories, but each frame carries a piece of the story.

Pick photos → set the mood (vibe, art style, context) → the app sends them to your photo book API → you get back a story you can tap and swipe through. Opens with a title page, one narrated frame per photo, and closes with a heartfelt sign-off.

## ✨ Features

- **Photo picker** — choose, reorder (drag or arrows), and remove up to 12 photos.
- **Story controls** — title, free-text context, vibe, art style, and a "stylize" toggle.
- **Stories-style viewer** — full-bleed styled images with an Instagram-style overlay (caption + narrative on a gradient scrim), a segmented progress bar, tap zones, swipe gestures, arrow buttons, and keyboard nav.
- **Opening & closing pages** rendered from the API's `title` / `opening` / `closing`.
- **Ken Burns** subtle zoom + text entrance animations.
- **Photo metadata → context** — reads EXIF (date/time + GPS) from the uploaded photos and offers to fold a line like "Photos taken on the evening of May 24, 2026 in Lisbon, Portugal" into the context (GPS is reverse-geocoded best-effort via OpenStreetMap).
- **Edit photos by chat** — on any photo slide, open **✦ Edit** to talk to the photo-chat API: "make it watercolor", "remove the background", "write a heartwarming caption". Style/edit results swap the photo in place; text answers can be applied as the caption or narrative. Powered by `/photo-chat/analyze` (type + scene-aware suggestions) and `/photo-chat/message` (auto-routed style/edit/text).
- **Voice narration** — reads the whole story aloud (opening → each frame → closing) in a **natural human voice** (ElevenLabs, via the `/api/narrate` serverless function), with automatic translation per language. Language switch for **English / Portuguese / Spanish**. Falls back to the browser's built-in voice when no backend/key is configured.
- **Share → standalone HTML** — export a finished story as one self-contained `.html` (images inlined) that anyone can open in a browser. No server, no build.
- **Demo mode** — explore the whole experience with no server, using your own photos and locally-written narration.

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the build
```

## 🔌 Connecting your API

Set the endpoint in one of two ways:

1. **Env var** — copy `.env.example` to `.env` and set:
   ```
   VITE_PHOTOBOOK_API_URL=https://your-server.example.com/api/photobook
   ```
2. **In the app** — open **API & demo settings** on the Creator screen and paste the URL (saved in your browser).

The app `POST`s JSON in this shape:

```jsonc
{
  "photos": [{ "photo": "<base64 image>" }, ...],
  "vibe": "heartwarming",
  "stylize_images": true,
  "style": "Retro_Toons",
  "title": "Our trip to Bonneville Salt Flats",
  "context": "During Memorial Day we went to the Bonneville Salt Flats as a family."
}
```

and expects a response shaped like:

```jsonc
{
  "request_id": "pb_715a9fd3",
  "title": "Our Trip to Bonneville Salt Flats",
  "vibe": "heartwarming",
  "opening": "On Memorial Day, we drove to ...",
  "pages": [
    {
      "page": 1,
      "narrative_beat": "Five people and a dog stood in line ...",
      "caption": "Hands linked, hearts whole.",
      "describe": "Five people and a dog ...",
      "styled_image_b64": "iVBORw0KGgoAAAANSU...",
      "style_applied": "Retro_Toons"
    }
  ],
  "closing": "We didn't just visit ...",
  "generated_at": "2026-05-29T17:54:34Z"
}
```

`styled_image_b64` may be raw base64 or a full `data:` URL — both render.

> **CORS:** the browser calls your API directly, so it must send permissive CORS headers (or be served from the same origin). If it can't, put a small proxy in front of it.

## 🌐 Run locally + share a public URL (no Vercel needed)

Runs the whole app **and** the narration voice on your machine, then exposes a
public link you can send to the team. Your ElevenLabs key never leaves your
computer.

```bash
# 1) put your key in .env.local (git-ignored)
echo 'ELEVENLABS_API_KEY=your-elevenlabs-key' > .env.local

# 2) build + serve everything on one local port
npm install
npm run share          # builds, then serves http://localhost:5050

# 3) in a second terminal, open a free public tunnel (no signup):
cloudflared tunnel --url http://localhost:5050
#   → prints a https://<random>.trycloudflare.com URL to share
```

Don't have `cloudflared`? Either install it (`brew install cloudflared`, or
download from Cloudflare), or use the zero-install alternative:

```bash
npx localtunnel --port 5050
```

Notes:
- `npm run serve` just serves the existing `dist/` (run `npm run build` first);
  `npm run share` does both. Rebuild after code changes.
- Without `ELEVENLABS_API_KEY`, narration falls back to the browser voice.
- The tunnel points at your machine, so keep the terminal open while sharing.

## ▲ Deploy to Vercel

The repo is zero-config for Vercel (Vite is auto-detected; `vercel.json` pins
the build just in case). Two ways:

**A. Connect the Git repo (recommended for the team)**

1. In Vercel → **Add New… → Project** → import `santos-jefferson/photobook2026`.
2. Framework: **Vite** · Build: `npm run build` · Output: `dist` (auto-filled).
3. Every push to the **production branch** publishes the main URL; every other
   branch / PR gets its own shareable **Preview URL** — great for team review.

**B. Vercel CLI (one-off)**

```bash
npm i -g vercel
vercel          # first run links the project + gives a preview URL
vercel --prod   # promote to the production URL
```

### Environment variables (Vercel → Project → Settings → Environment Variables)

```
VITE_PHOTOBOOK_API_URL=https://your-server.example.com/api/photobook
VITE_PHOTOBOOK_API_KEY=your-key

# Natural-voice narration (server-side; keep secret — no VITE_ prefix):
ELEVENLABS_API_KEY=your-elevenlabs-key
# optional: ELEVENLABS_VOICE_ID / ELEVENLABS_VOICE_ID_EN / _PT / _ES
```

The natural voice runs through the `api/narrate` serverless function (auto-detected
by Vercel), which translates the text per language and calls ElevenLabs. Without
`ELEVENLABS_API_KEY`, narration gracefully falls back to the browser voice.

> ⚠️ **`VITE_`-prefixed vars are bundled into the public client JS** — anyone can
> read them in the browser. Don't ship a real secret this way; use a throwaway
> key or a backend proxy for anything sensitive.
>
> ⚠️ **Internal API reachability:** if your API host is on a private/corporate
> network, a teammate opening the public Vercel URL **won't be able to reach it**
> (their browser calls the API directly). For those reviewers, use **Demo mode**
> or send them a **Share → Download HTML** export, which is fully self-contained.

## 🗂 Structure

```
src/
  api.js                 API call, payload builder, demo-response generator
  book.js                turns an API response into ordered story slides
  config.js              endpoint default, vibes, styles, limits
  components/
    Creator.jsx          photo picker + story options + API settings
    StoryViewer.jsx      the swipeable stories experience
    Loader.jsx           generating animation
```

## ⚠️ Notes

- **Narration voice quality** uses the device's built-in TTS voices, which vary
  by OS/browser and aren't fully "human". For premium natural voices (e.g.
  ElevenLabs / OpenAI TTS) we'd add a small backend that holds the API key and
  returns audio — the narration UI is already structured to swap the audio
  source. Note: the voice reads the story's existing text; truly multilingual
  narration also needs the story *text* generated/translated per language.
- Photo-chat edits are kept in the viewer's local copy of the story and flow
  into the narration and the HTML export. They are not persisted server-side.
- This is an MVP. Natural next steps: premium narration voices, persistence,
  and a backend proxy for private API keys.
