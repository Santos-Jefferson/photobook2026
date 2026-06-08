// Local library of saved photobooks, persisted in IndexedDB. A generated book
// (with its base64 images) is large, so localStorage's ~5MB ceiling is too small
// for more than one or two — IndexedDB comfortably holds a shelf of them.
//
// Two stores keep listing cheap: `meta` holds the small record shown in the
// library grid (title, date, a downscaled cover thumbnail); `books` holds the
// full serialized book keyed by the same id, loaded only when one is opened.

import { resolveImageSrc } from './book'

const DB_NAME = 'photobook'
const VERSION = 1
const META = 'meta'
const BOOKS = 'books'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(BOOKS)) db.createObjectStore(BOOKS, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function reqDone(req) {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

function txDone(t) {
  return new Promise((res, rej) => {
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}

// Metadata for every saved book, newest first.
export async function listSavedBooks() {
  const db = await openDb()
  try {
    const all = await reqDone(db.transaction(META, 'readonly').objectStore(META).getAll())
    return all.sort((a, b) => b.savedAt - a.savedAt)
  } finally {
    db.close()
  }
}

// The full book for an id (or null).
export async function getSavedBook(id) {
  const db = await openDb()
  try {
    const rec = await reqDone(db.transaction(BOOKS, 'readonly').objectStore(BOOKS).get(id))
    return rec ? rec.book : null
  } finally {
    db.close()
  }
}

export async function deleteSavedBook(id) {
  const db = await openDb()
  try {
    const t = db.transaction([META, BOOKS], 'readwrite')
    t.objectStore(META).delete(id)
    t.objectStore(BOOKS).delete(id)
    await txDone(t)
  } finally {
    db.close()
  }
}

// Save (or update, when `existingId` is given) a book. Computes a small cover
// thumbnail and lightweight metadata for the library grid. Returns the id.
export async function saveBook(book, existingId) {
  const id = existingId || 'pb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  const title = (book && book.title && String(book.title).trim()) || 'Untitled photobook'
  const pageCount = book && Array.isArray(book.pages) ? book.pages.length : 0
  const cover = await makeCover((book && book.__cover) || firstImageSrc(book))
  const db = await openDb()
  try {
    const t = db.transaction([META, BOOKS], 'readwrite')
    t.objectStore(META).put({ id, title, pageCount, cover, savedAt: Date.now() })
    t.objectStore(BOOKS).put({ id, book })
    await txDone(t)
    return id
  } finally {
    db.close()
  }
}

function firstImageSrc(book) {
  const pages = book && Array.isArray(book.pages) ? book.pages : []
  for (const p of pages) {
    const src = resolveImageSrc(p && p.styled_image_b64) || resolveImageSrc(p && p.original_image)
    if (src) return src
  }
  return ''
}

// Downscale an image src to a compact JPEG data URL for the library grid.
function makeCover(src, maxW = 420) {
  return new Promise((resolve) => {
    if (!src) return resolve('')
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / (img.naturalWidth || maxW))
        const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale))
        const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch {
        resolve('')
      }
    }
    img.onerror = () => resolve('')
    img.src = src
  })
}
