import { DEFAULT_API_URL, DEFAULT_API_KEY } from './config'

const API_URL_KEY = 'photobook.apiUrl'
const API_KEY_KEY = 'photobook.apiKey'

export function getApiUrl() {
  return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL
}

export function setApiUrl(url) {
  if (url) localStorage.setItem(API_URL_KEY, url)
  else localStorage.removeItem(API_URL_KEY)
}

export function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) ?? DEFAULT_API_KEY
}

export function setApiKey(key) {
  if (key) localStorage.setItem(API_KEY_KEY, key)
  else localStorage.removeItem(API_KEY_KEY)
}

// Read a File into a raw base64 string (no data: prefix), which is what the
// API request expects per the documented payload.
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result || ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Phone photos are often stored as landscape pixels plus an EXIF orientation
// flag that tells viewers to rotate them. Sending the raw bytes makes the
// server process the un-rotated pixels, so a portrait shot comes back
// landscape. This bakes the EXIF rotation into the actual pixels (and lightly
// caps the size) so the server — and the final story — keep the orientation
// the user actually sees. Returns raw base64 (no data: prefix).
export async function fileToOrientedBase64(file, maxDim = 1536) {
  try {
    // `imageOrientation: 'from-image'` applies the EXIF rotation to the bitmap.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    let { width, height } = bitmap
    if (!width || !height) throw new Error('empty bitmap')

    const scale = Math.min(1, maxDim / Math.max(width, height))
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const comma = dataUrl.indexOf(',')
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  } catch (err) {
    // Older browsers / odd formats: fall back to the raw bytes.
    console.warn('[Photobook] orientation normalize failed, sending raw bytes:', err)
    return fileToBase64(file)
  }
}

// Build the request body in the exact shape the server expects. `perspective`
// is carried for the client-side POV rewrite (and forwarded in case the API
// later honors it); it doesn't affect the documented fields above.
export function buildPayload({ photosBase64, vibe, stylizeImages, style, title, context, perspective }) {
  return {
    photos: photosBase64.map((photo) => ({ photo })),
    vibe,
    stylize_images: stylizeImages,
    style,
    title,
    context,
    perspective: perspective || 'ai',
  }
}

// POST to the real photo book API and return the parsed response.
export async function generatePhotoBook(payload, { signal } = {}) {
  const url = getApiUrl()
  if (!url) {
    throw new Error('No API URL configured. Add it in the API settings, or use the demo mode.')
  }

  const key = getApiKey()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      /* ignore */
    }
    throw new Error(`API responded ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
  }

  return res.json()
}

// Demo mode: synthesize a response in the documented shape so the whole
// experience is explorable without a live server. Uses the user's own photos
// as the "styled" images and writes light narration from the form inputs.
export function buildDemoResponse(payload, previewDataUrls) {
  const niceTitle = payload.title || 'Our Story'
  const beats = [
    {
      narrative_beat: `It began here, with everyone together and the day still ahead of us.`,
      caption: 'The beginning of something good.',
    },
    {
      narrative_beat: `We slowed down, looked around, and let the moment settle in.`,
      caption: 'Right where we wanted to be.',
    },
    {
      narrative_beat: `Laughter spilled over. Nobody wanted it to end.`,
      caption: 'Together, and that was enough.',
    },
    {
      narrative_beat: `The light softened and so did we, holding onto the day.`,
      caption: 'A memory in the making.',
    },
    {
      narrative_beat: `One more look around before we headed home.`,
      caption: 'Carrying it all back with us.',
    },
    {
      narrative_beat: `And just like that, it became a story we'd tell for years.`,
      caption: 'Until next time.',
    },
  ]

  const pages = previewDataUrls.map((dataUrl, i) => {
    const beat = beats[i % beats.length]
    return {
      page: i + 1,
      narrative_beat: beat.narrative_beat,
      caption: beat.caption,
      describe: payload.context || '',
      styled_image_b64: dataUrl, // already a data URL; viewer handles both forms
      style_applied: payload.style,
    }
  })

  return {
    request_id: 'demo_' + Math.random().toString(36).slice(2, 10),
    title: niceTitle,
    vibe: payload.vibe,
    opening:
      payload.context ||
      `This is the story of ${niceTitle.toLowerCase()} — the people, the place, and the small moments that made it ours.`,
    pages,
    closing: `We didn't just make memories — we made a story worth keeping. ${niceTitle}, always.`,
    generated_at: new Date().toISOString(),
  }
}
