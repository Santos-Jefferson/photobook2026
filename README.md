# 📖 Photobook

Turn a handful of photos from your library into a **swipeable, narrated photo book** — like Instagram Stories, but each frame carries a piece of the story.

Pick photos → set the mood (vibe, art style, context) → the app sends them to your photo book API → you get back a story you can tap and swipe through. Opens with a title page, one narrated frame per photo, and closes with a heartfelt sign-off.

## ✨ Features

- **Photo picker** — choose, reorder (drag or arrows), and remove up to 12 photos.
- **Story controls** — title, free-text context, vibe, art style, and a "stylize" toggle.
- **Stories-style viewer** — full-bleed styled images with an Instagram-style overlay (caption + narrative on a gradient scrim), a segmented progress bar, tap zones, swipe gestures, arrow buttons, and keyboard nav.
- **Opening & closing pages** rendered from the API's `title` / `opening` / `closing`.
- **Ken Burns** subtle zoom + text entrance animations.
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
```

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

- This is an MVP — no persistence/sharing yet. Natural next steps: save/share a book via link, export to video/PDF, and a backend proxy for private API keys.
