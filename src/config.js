// Central place for tunable options + API endpoint.

// The API URL comes from an env var (VITE_PHOTOBOOK_API_URL) when set, falling
// back to the known production endpoint. It can also be overridden at runtime
// from the Creator screen (stored in localStorage), so you can point at a
// different server without rebuilding.
export const DEFAULT_API_URL =
  import.meta.env.VITE_PHOTOBOOK_API_URL ||
  'https://genius-narration-api.use.eks.mcap.sip.dev.cloud.synchronoss.net/v1/genius/photobook'

// Bearer token sent as `Authorization: Bearer <key>`. Defaults to the dev key;
// override via env var or the in-app API settings (stored in the browser).
export const DEFAULT_API_KEY = import.meta.env.VITE_PHOTOBOOK_API_KEY || 'dev-secret'

// Vibes the API supports — must match the server's catalog exactly or it
// returns a 400 ("Invalid vibe ...").
export const VIBES = ['heartwarming', 'nostalgic', 'poetic', 'funny', 'minimal', 'epic']

// Image styles the API supports — must match the server's catalog exactly or
// it returns a 400 ("Invalid style ...").
export const STYLES = [
  '3D_Cartoon',
  'Anime',
  'Art',
  'Cartoon_Illustration',
  'Color_Pop_People_Gray_Background',
  'Colorize_Photo',
  'Comic_Book',
  'Enhance_Photo',
  'Ocean',
  'Oil_Painting',
  'Pencil_Sketch',
  'Repair_Photo',
  'Retro_Toons',
  'Sketch',
  'Starry_Night',
  'Watercolor_Sketch',
  'Whimsy_Anime',
]

export const MAX_PHOTOS = 5

// A photobook needs at least this many photos (a single photo can't tell a
// story). Enforced in every create flow (uploader, Photos selection, memories).
export const MIN_PHOTOS = 2

// Narrator perspective for the story. `ai` is the neutral default (no rewrite);
// the others retell the captions/narration in that voice via the LLM.
export const PERSPECTIVES = [
  { code: 'ai', label: 'AI Storyteller' },
  { code: 'me', label: 'My Perspective' },
  { code: 'child', label: 'Child Perspective' },
  { code: 'friend', label: 'Friend Perspective' },
  { code: 'parent', label: 'Parent Perspective' },
]
