// Wrapper for the Genius "photo-chat" endpoints, used to edit a story's photos
// after generation: analyze (detect type + suggestions), message (auto-routed
// style / edit / text), and ask (direct Q&A).
//
// These live next to the photobook endpoint on the same host, so we derive the
// base from the configured photobook URL (".../v1/genius/photobook" →
// ".../v1/genius") and reuse the same Bearer key.

import { getApiUrl, getApiKey } from './api'
import { DEFAULT_API_URL } from './config'

function geniusBase() {
  const url = getApiUrl() || DEFAULT_API_URL || ''
  const trimmed = url.replace(/\/+$/, '').replace(/\/photobook$/, '')
  return trimmed || 'https://genius-narration-api.use.eks.mcap.sip.dev.cloud.synchronoss.net/v1/genius'
}

async function post(path, body) {
  const key = getApiKey()
  const res = await fetch(geniusBase() + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      /* ignore */
    }
    throw new Error(`API ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 300)}` : ''}`)
  }
  return res.json()
}

// Accepts a data URL or raw base64 and returns what the API expects (raw
// base64, or an https URL passed straight through).
export function toApiPhoto(src) {
  if (!src) return ''
  if (src.startsWith('http')) return src
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',')
    return comma >= 0 ? src.slice(comma + 1) : src
  }
  return src
}

export function analyzePhoto(photo) {
  return post('/photo-chat/analyze', { photo: toApiPhoto(photo) })
}

export function sendPhotoMessage({ photo, message, selectedStyle, imageType }) {
  return post('/photo-chat/message', {
    photo: toApiPhoto(photo),
    message,
    ...(selectedStyle ? { selected_style: selectedStyle } : {}),
    ...(imageType ? { image_type: imageType } : {}),
  })
}

export function askPhoto({ photo, question, imageType }) {
  return post('/photo-chat/ask', {
    photo: toApiPhoto(photo),
    question,
    ...(imageType ? { image_type: imageType } : {}),
  })
}

// Generate a personalized greeting card from this memory. With a photo, the
// response also includes a holiday-styled `styled_image_b64`.
export function generateGreetingCard({ holiday, tone, photo, recipient, context }) {
  return post('/greeting-card', {
    holiday,
    ...(tone ? { tone } : {}),
    ...(photo ? { photo: toApiPhoto(photo) } : {}),
    ...(recipient ? { recipient } : {}),
    ...(context ? { context } : {}),
  })
}

// A curated subset of the API's holiday keys (label shown in the picker).
export const HOLIDAYS = [
  { key: 'christmas', label: 'Christmas' },
  { key: 'new_years_day', label: "New Year's Day" },
  { key: 'valentines_day', label: "Valentine's Day" },
  { key: 'mothers_day', label: "Mother's Day" },
  { key: 'fathers_day', label: "Father's Day" },
  { key: 'thanksgiving', label: 'Thanksgiving' },
  { key: 'halloween', label: 'Halloween' },
  { key: 'easter', label: 'Easter' },
  { key: 'independence_day_250', label: '250th Independence Day' },
  { key: 'lunar_new_year', label: 'Lunar New Year' },
  { key: 'eid_al_fitr', label: 'Eid al-Fitr' },
  { key: 'hanukkah', label: 'Hanukkah' },
]

export const CARD_TONES = ['heartwarming', 'funny', 'poetic', 'patriotic', 'spiritual', 'formal']
