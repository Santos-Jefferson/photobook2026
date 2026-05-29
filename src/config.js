// Central place for tunable options + API endpoint.

// The API URL comes from an env var (VITE_PHOTOBOOK_API_URL) when set, falling
// back to the known production endpoint. It can also be overridden at runtime
// from the Creator screen (stored in localStorage), so you can point at a
// different server without rebuilding.
export const DEFAULT_API_URL =
  import.meta.env.VITE_PHOTOBOOK_API_URL ||
  'https://genius-narration-api.use.eks.mcap.sip.dev.cloud.synchronoss.net/v1/genius/photobook'

export const VIBES = [
  'heartwarming',
  'nostalgic',
  'adventurous',
  'playful',
  'romantic',
  'dramatic',
  'peaceful',
  'epic',
]

// Image styles your API supports. Edit to match your model's catalog.
export const STYLES = [
  'Retro_Toons',
  'Watercolor',
  'Comic_Book',
  'Anime',
  'Oil_Painting',
  'Storybook',
  'Pixel_Art',
  'Polaroid',
]

export const MAX_PHOTOS = 12
