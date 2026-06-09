// Pull useful EXIF metadata out of uploaded photos (date/time + GPS) and turn
// it into a short, human-readable context line we can feed to the photobook
// API — e.g. "Photos taken on the evening of May 24, 2026 in Lisbon, Portugal."

import exifr from 'exifr'

// Read date + GPS from a single file. Always resolves (never throws) so one
// odd photo can't break the batch.
export async function readPhotoMeta(file) {
  try {
    const data = await exifr.parse(file, { gps: true })
    if (!data) return {}
    const rawDate = data.DateTimeOriginal || data.CreateDate || data.ModifyDate || null
    let date = null
    if (rawDate instanceof Date && !isNaN(rawDate)) date = rawDate
    else if (rawDate) {
      const d = new Date(rawDate)
      if (!isNaN(d)) date = d
    }
    const latitude = typeof data.latitude === 'number' ? data.latitude : null
    const longitude = typeof data.longitude === 'number' ? data.longitude : null
    return { date, latitude, longitude }
  } catch {
    return {}
  }
}

function timeOfDay(hour) {
  if (hour < 5) return 'late at night'
  if (hour < 12) return 'in the morning'
  if (hour < 17) return 'in the afternoon'
  if (hour < 21) return 'in the evening'
  return 'at night'
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Best-effort reverse geocoding via OpenStreetMap Nominatim. Returns '' on any
// failure (offline, blocked, rate-limited) — the coordinates fall back instead.
async function reverseGeocode(lat, lon) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=' +
      encodeURIComponent(lat) +
      '&lon=' +
      encodeURIComponent(lon)
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    clearTimeout(t)
    if (!res.ok) return ''
    const j = await res.json()
    const a = j.address || {}
    const city = a.city || a.town || a.village || a.municipality || a.county
    return [city, a.country].filter(Boolean).join(', ')
  } catch {
    return ''
  }
}

// Turn an array of per-photo metas into { summary, place, hasData }.
// `summary` is the sentence to append to context; `place` is shown in the UI.
export async function summarizePhotoMeta(metas) {
  const dates = metas
    .map((m) => m && m.date)
    .filter(Boolean)
    .sort((a, b) => a - b)

  const firstCoord = metas.find((m) => m && m.latitude != null && m.longitude != null)

  const parts = []
  let place = ''

  if (dates.length) {
    const first = dates[0]
    const last = dates[dates.length - 1]
    const sameDay = first.toDateString() === last.toDateString()
    if (sameDay) {
      parts.push('Photos taken on ' + formatDate(first) + ' ' + timeOfDay(first.getHours()))
    } else {
      parts.push('Photos taken between ' + formatDate(first) + ' and ' + formatDate(last))
    }
  }

  if (firstCoord) {
    place = await reverseGeocode(firstCoord.latitude, firstCoord.longitude)
    if (!place) {
      place = firstCoord.latitude.toFixed(4) + ', ' + firstCoord.longitude.toFixed(4)
    }
    if (parts.length) parts.push('in ' + place)
    else parts.push('Photos taken in ' + place)
  }

  const summary = parts.length ? parts.join(' ') + '.' : ''
  return { summary, place, hasData: Boolean(summary) }
}

// Compact, IndexedDB-friendly form of a photo's meta (date as a timestamp).
export function metaToStored(meta) {
  if (!meta) return null
  const t = meta.date instanceof Date ? meta.date.getTime() : typeof meta.date === 'number' ? meta.date : null
  const lat = typeof meta.latitude === 'number' ? meta.latitude : null
  const lon = typeof meta.longitude === 'number' ? meta.longitude : null
  if (t == null && lat == null && lon == null) return null
  return { t, lat, lon }
}

// Summarize a list of stored metas (from metaToStored) into the context line.
export async function summarizeStoredMetas(stored) {
  const metas = (stored || []).map((s) =>
    s ? { date: s.t ? new Date(s.t) : null, latitude: s.lat, longitude: s.lon } : {},
  )
  return summarizePhotoMeta(metas)
}
