# 📖 Photobook

> Turn your library photos — or a single **Memory** — into a swipeable,
> AI‑narrated photo‑book story.

Photobook takes a handful of photos, sends them to the **Synchronoss Genius
Narration API**, and weaves them into an illustrated, narrated story you can swipe
through, translate, narrate aloud, edit photo‑by‑photo, save, and share. It’s
mobile‑first and designed to feel like a natural extension of **Capsyl**
(Memories → Photobook).

Pick photos → set the mood (vibe, art style, narrator perspective) → get back a
story that opens with a title page, plays one narrated frame per photo, and closes
with a heartfelt sign‑off.

---

## Table of contents

- [Highlights](#-highlights)
- [Tech stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project structure](#-project-structure)
- [Run it](#-run-it)
- [Configuration](#-configuration)
- [API surface](#-api-surface)
- [Data & storage](#-data--storage)
- [Run locally + share a public URL](#-run-locally--share-a-public-url)
- [Deploy to Vercel](#-deploy-to-vercel)
- [Deploy on Kubernetes](#-deploy-on-kubernetes-docker--helm)
- [Notes & roadmap](#-notes--roadmap)

---

## ✨ Highlights

| Area | What it does |
|------|--------------|
| **Generate** | Pick up to 5 photos, choose a *vibe*, *image style*, and *narrator perspective*. EXIF date/place is folded into the prompt. The Genius API returns a titled story (opening · per‑photo caption + narrative · closing) with stylized images. |
| **Memories** | A Capsyl‑style gallery. Group **your own** photos into a Memory (title + cluster, stored locally), then turn it into a photobook in one tap — with a baked, display‑font cover over the lead photo. |
| **Story viewer** | Full‑screen, swipeable slides with an Instagram‑style overlay, segmented progress, tap zones, swipe & keyboard nav, Ken Burns motion, and cover collage. |
| **Narration** | Neural text‑to‑speech with selectable **language** and **voice (gender)** via a touch‑friendly bottom sheet. Reads opening → each frame → closing. |
| **Translate** | Translate the whole story on the fly to any supported language (internal LLM). |
| **Perspective** | Retell the story as *AI storyteller*, *me*, *child*, *friend*, or *parent* (internal LLM rewrite). |
| **Photo Chat** | Per‑photo edit panel: natural‑language edits (“make it watercolor”), one‑tap **style presets**, **memory actions** (Child’s POV / Funnier / More emotional / Translate), and ✨ **Greeting card** (Genius greeting‑card endpoint). |
| **Saved** | A local library of finished photobooks (IndexedDB), reopenable any time. |
| **Export & share** | Download a **PDF**, a **self‑contained HTML** (collage + offline narration), share to **WhatsApp**, or render an **Instagram** cover. |
| **Mobile** | Capsyl‑style bottom navigation, safe‑area aware CTAs, touch‑friendly sheets. |
| **Demo mode** | Explore the whole experience with no backend, using your own photos + locally‑written narration. |

---

## 🧱 Tech stack

- **Frontend:** React 18 + Vite 5, hand‑written CSS (no UI framework). Navigation is
  a small `view` state machine in `App.jsx` (no router).
- **Backend:** a tiny Node `http` server (`server/index.js`) that serves the built
  SPA **and** a few `/api/*` endpoints. The same handlers are also exposed as
  **Vercel serverless functions** under `api/*`, sharing the core in `lib/narrate.js`.
- **AI / external services:**
  - **Genius Narration API** — photobook generation, photo‑chat edits, greeting
    cards, image stylization.
  - **Internal LLM (Qwen)** — translation, narrator‑perspective rewrite, free‑form
    text rewrites (behind our own `/api/*`).
  - **msedge‑tts** — free Microsoft Edge neural voices for narration.
- **Browser libraries:** `exifr` (EXIF/GPS), `jspdf` + `html2canvas` (PDF / IG cover),
  `undici` (server‑side fetch).
- **Storage:** IndexedDB (saved photobooks, user memories), localStorage (API
  settings).

---

## 🗺 Architecture

```
┌──────────────────────────── Browser (React SPA) ────────────────────────────┐
│                                                                              │
│  Creator ──────────┐         Memories ───────┐        SavedBooks            │
│  (upload, vibe,     │         (user clusters, │        (IndexedDB library)  │
│   style, EXIF)      │          New Memory)    │                             │
│         │           └───────────────┬─────────┘                             │
│         │  buildPayload             │ generateFromMemory                     │
│         ▼                           ▼                                        │
│   ┌───────────────── App.jsx (view state machine) ─────────────────┐        │
│   │   handleGenerate → normalizeBook → perspective rewrite          │        │
│   └───────────────────────────┬────────────────────────────────────┘        │
│                               ▼                                              │
│                         StoryViewer                                         │
│        buildSlides · Ken Burns · narration · translation · PhotoChat         │
│           │            │             │            │           │              │
└───────────┼────────────┼─────────────┼────────────┼───────────┼──────────────┘
            │            │             │            │           │
            ▼            ▼             ▼            ▼           ▼
   Genius /photobook  /api/narrate  /api/translate /api/perspective  Genius
   (generate + style)  (msedge-tts)  (Qwen)        (Qwen)        photo-chat /
                                                                 greeting-card
```

**Generation flow**

1. `Creator` converts each photo to EXIF‑oriented, capped JPEG base64 and extracts
   date/place via `exifr` (GPS reverse‑geocoded best‑effort).
2. `buildPayload` assembles `{ photos, vibe, style, stylize_images, title, context,
   perspective }` and `POST`s it to the Genius **photobook** endpoint (Bearer auth).
3. `normalizeBook` unwraps the response and flags truncation; uploaded photos are
   kept as fallbacks.
4. The story is optionally **retold in the chosen perspective** via the internal LLM.
5. `StoryViewer` renders slides; narration, translation, and per‑photo edits are
   fetched on demand.

**Own backend** (`server/index.js` and `api/*`) wraps the internal LLM/TTS so
secrets stay server‑side:

| Route | Purpose | Backed by |
|-------|---------|-----------|
| `POST /api/narrate` | TTS audio for narration | `msedge-tts` |
| `POST /api/translate` | Translate story text | internal LLM |
| `POST /api/perspective` | Retell in a narrator POV | internal LLM |
| `POST /api/rewrite` | Free‑form text rewrite (memory actions) | internal LLM |
| `GET  /healthz` | Liveness/readiness probe | — |

---

## 📁 Project structure

```
photobook2026/
├── server/index.js          # Node server: serves SPA + /api/* (default PORT 5050)
├── lib/narrate.js           # Shared core: TTS, translate, perspective, rewrite
├── api/                     # Vercel serverless wrappers (narrate/translate/…)
├── src/
│   ├── App.jsx              # View state machine (create | memories | saved | story)
│   ├── components/
│   │   ├── Creator.jsx      # Upload + options + generate
│   │   ├── Memories.jsx     # Capsyl-style gallery + New Memory
│   │   ├── StoryViewer.jsx  # Swipeable story, narration, translate, save, share
│   │   ├── PhotoChat.jsx    # Per-photo edit panel + memory actions
│   │   ├── SavedBooks.jsx   # IndexedDB library
│   │   ├── BottomNav.jsx    # Capsyl-style mobile bottom nav
│   │   ├── Loader.jsx · ErrorBoundary.jsx
│   ├── api.js               # Photo → base64, payload, generate, demo mode, settings
│   ├── book.js              # normalizeBook · buildSlides · resolveImageSrc
│   ├── config.js            # API URL/key, VIBES, STYLES, PERSPECTIVES, MAX_PHOTOS
│   ├── narration.js         # useNarration hook, NARRATION_LANGS, VOICE_OPTIONS
│   ├── translateClient.js · perspectiveClient.js · memoryClient.js
│   ├── photoChat.js         # Genius photo-chat + greeting-card client
│   ├── metadata.js          # EXIF date/time/GPS → context line
│   ├── bookStorage.js       # IndexedDB: saved photobooks
│   ├── memoryStore.js       # IndexedDB: user memories
│   ├── demoMemory.js        # Canvas cover baking (title over photo)
│   ├── export.js · share.js # PDF / HTML / WhatsApp / Instagram
│   └── index.css
└── package.json
```

---

## 🚀 Run it

**Requirements:** Node 18+ (developed on Node 22).

```bash
npm install
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the build
npm run share    # build + serve SPA *and* /api together → http://localhost:5050
```

> **Demo mode:** if no API URL is configured, the app synthesizes a story from your
> uploaded photos so the full flow is clickable without a backend.

---

## 🔧 Configuration

All settings can be supplied via env vars **or** overridden at runtime from the
Creator’s *API settings* (saved in `localStorage`).

| Variable | Default | Meaning |
|----------|---------|---------|
| `VITE_PHOTOBOOK_API_URL` | `…/v1/genius/photobook` | Genius photobook endpoint. The photo‑chat / greeting‑card base is derived from this. |
| `VITE_PHOTOBOOK_API_KEY` | `dev-secret` | Bearer token for the Genius API. |
| `PORT` | `5050` | Port for the Node server. |

Catalogs that **must match the server** (in `src/config.js`):

- **Vibes:** `heartwarming, nostalgic, poetic, funny, minimal, epic`
- **Styles:** `Retro_Toons, Watercolor_Sketch, Anime, Oil_Painting, Comic_Book, …`
- **Perspectives:** `ai (default), me, child, friend, parent`
- **Max photos per book:** `5`

---

## 🔌 API surface

**External — Genius Narration API** (Bearer auth, same host):

- `POST /v1/genius/photobook` — generate a story from photos.
- `POST /v1/genius/photo-chat/analyze` — detect image type + edit suggestions.
- `POST /v1/genius/photo-chat/message` — auto‑routed style / edit / text response.
- `POST /v1/genius/photo-chat/ask` — direct Q&A about a photo.
- `POST /v1/genius/greeting-card` — greeting card (headline/message/closing + optional
  holiday‑styled image).

The app `POST`s the photobook request as:

```jsonc
{
  "photos": [{ "photo": "<base64 image>" }, ...],
  "vibe": "heartwarming",
  "stylize_images": true,
  "style": "Retro_Toons",
  "title": "A Day at the Lake",
  "context": "A family summer day at a mountain lake.",
  "perspective": "ai"
}
```

and expects a response shaped like:

```jsonc
{
  "request_id": "pb_715a9fd3",
  "title": "A Day at the Lake",
  "vibe": "heartwarming",
  "opening": "It began at dawn ...",
  "pages": [
    {
      "page": 1,
      "narrative_beat": "We arrived as the mist lifted ...",
      "caption": "First light on the water.",
      "describe": "A dock at sunrise ...",
      "styled_image_b64": "iVBORw0KGgoAAAANSU...",
      "style_applied": "Retro_Toons"
    }
  ],
  "closing": "And just like that, it became a story.",
  "generated_at": "2026-06-02T17:54:34Z"
}
```

`styled_image_b64` may be raw base64 or a full `data:` URL — both render.

> **CORS:** the browser calls the Genius API directly, so it must send permissive
> CORS headers (or be served same‑origin). If it can’t, put a small proxy in front.

**Internal — our own backend** (`server/index.js` and `api/*`): see the table in
[Architecture](#-architecture).

---

## 🗃 Data & storage

- **IndexedDB `photobook`** — saved photobooks (`meta` store for the grid + `books`
  store for the full serialized book, images inline as base64).
- **IndexedDB `photobook_memories`** — user‑created memories (title + photos as JPEG
  data URLs).
- **localStorage** — `photobook.apiUrl`, `photobook.apiKey`.

Nothing leaves the browser except the photos sent to the configured Genius API and
the text sent to our own `/api/*` endpoints. Photo‑chat edits live in the viewer’s
local copy of the story (and flow into narration + exports); use **Save** to persist
a finished book to the local library.

---

## 🌐 Run locally + share a public URL

Runs the whole app **and** the natural‑voice narration on your machine (no keys, no
Vercel), then exposes a public link.

```bash
npm install
npm run share          # builds, then serves http://localhost:5050

# in a second terminal, open a free public tunnel (no signup):
cloudflared tunnel --url http://localhost:5050
#   → prints a https://<random>.trycloudflare.com URL to share
```

No `cloudflared`? Use the zero‑install alternative: `npx localtunnel --port 5050`.

Notes:
- Narration uses free Microsoft Edge neural voices — nothing to configure.
- `npm run serve` serves the existing `dist/` (run `npm run build` first); `npm run
  share` does both. Rebuild after code changes.
- Behind a corporate proxy? Set `HTTPS_PROXY` so the server’s outbound calls go
  through it.

---

## ▲ Deploy to Vercel

Zero‑config (Vite auto‑detected; `vercel.json` pins the build).

1. Vercel → **Add New… → Project** → import the repo.
2. Framework **Vite** · Build `npm run build` · Output `dist` (auto‑filled).
3. Production branch publishes the main URL; other branches/PRs get **Preview URLs**.

CLI: `npm i -g vercel` then `vercel` (preview) / `vercel --prod`.

Environment variables (Project → Settings → Environment Variables):

```
VITE_PHOTOBOOK_API_URL=https://your-server.example.com/v1/genius/photobook
VITE_PHOTOBOOK_API_KEY=your-key
# Optional narration voice overrides (defaults are fine):
# EDGE_VOICE_EN=en-US-AriaNeural
# EDGE_VOICE_PT=pt-BR-FranciscaNeural
# EDGE_VOICE_ES=es-ES-ElviraNeural
```

> ⚠️ `VITE_`‑prefixed vars are bundled into the **public** client JS — don’t ship a
> real secret this way; use a throwaway key or a backend proxy.
>
> ⚠️ If the Genius API host is on a private network, a teammate opening the public
> URL won’t be able to reach it (their browser calls it directly). For those
> reviewers, use **Demo mode** or a **Share → Download HTML** export.

---

## ☸️ Deploy on Kubernetes (Docker + Helm)

The Node server serves the built SPA **and** the `/api/*` endpoints, so it’s a
**single container**.

```bash
docker build -t your-registry/photobook:1.0.0 --build-arg APP_VERSION=1.0.0 .
docker push your-registry/photobook:1.0.0

helm upgrade --install photobook deployment/helm/photobook \
  --set image.repository=your-registry/photobook \
  --set image.tag=1.0.0 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=photobook.yourcompany.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

The chart (`deployment/helm/photobook`) ships a Deployment (with `/healthz`
liveness/readiness probes), Service, and optional Ingress. Tune `values.yaml` for
replicas, resources, ingress/TLS, autoscaling, and env.

A `Makefile` mirrors the company’s ECR/Helm‑OCI (Bamboo) flow:

```bash
make show-config     # print resolved image/tag/repo/versions
make all             # build+push image, package+push helm chart
make bump-patch      # bump app version (also bump-minor)
```

Things to know:
- **`VITE_*` are build‑time** — pass as `--build-arg`, not runtime env (they end up
  in the public bundle).
- **No runtime secrets needed** — narration/translation are key‑less.
- **Egress:** pods need outbound internet for the voice/LLM services (or set
  `HTTPS_PROXY`).
- **Genius API reachability:** the browser calls it directly, so users must be able
  to reach that host.

---

## 📝 Notes & roadmap

- **Narration voice** uses free Microsoft Edge neural voices through `/api/narrate`
  (with per‑language translation). When that server isn’t running (e.g. the static
  HTML export) it falls back to the device’s built‑in voice. Edge voices use an
  unofficial endpoint — fine for an MVP; swap in a paid TTS later for a guaranteed
  SLA (the narration UI is structured to swap the audio source).
- **Mobile packaging:** because the deployed host serves both the SPA and `/api/*`
  on one origin, the app can become an installable **PWA** (“Add to Home Screen”) or
  a thin **Capacitor** Android shell pointing at that URL.
- **Next steps:** native Capsyl Memories integration, PWA/`.apk` packaging, richer
  greeting‑card composition, and server‑side persistence.
