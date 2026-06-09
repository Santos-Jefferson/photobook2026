// Local store for the user's photo library — the photos shown under the Capsyl
// "Photos" tab. Kept in its own IndexedDB database (photos are base64 data
// URLs, too large for localStorage). Selecting photos here feeds the photobook
// generator, mirroring Capsyl's multi-select → action flow.

const DB_NAME = 'photobook_photos'
const VERSION = 1
const STORE = 'photos'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
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

// Newest first. Each: { id, url (dataURL), favorite, createdAt }
export async function listPhotos() {
  const db = await openDb()
  try {
    const all = await reqDone(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
    return all.sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    db.close()
  }
}

// Add several photos at once. Each item is `{ url, meta }` (meta from
// metaToStored — date/GPS), or a bare url string. Returns the created records.
export async function addPhotos(items) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    const now = Date.now()
    const records = (items || []).map((item, i) => {
      const { url, meta } = typeof item === 'string' ? { url: item, meta: null } : item
      return {
        id: 'ph_' + (now + i).toString(36) + Math.random().toString(36).slice(2, 7),
        url,
        meta: meta || null,
        favorite: false,
        // Offset so a batch keeps its picked order (newest-first listing).
        createdAt: now + i,
      }
    })
    records.forEach((r) => store.put(r))
    await txDone(t)
    return records
  } finally {
    db.close()
  }
}

export async function setFavorite(id, favorite) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    const rec = await reqDone(store.get(id))
    if (rec) {
      rec.favorite = !!favorite
      store.put(rec)
    }
    await txDone(t)
  } finally {
    db.close()
  }
}

// Replace a photo's image (e.g. after editing it in the photo chat).
export async function updatePhotoImage(id, url) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    const rec = await reqDone(store.get(id))
    if (rec) {
      rec.url = url
      store.put(rec)
    }
    await txDone(t)
  } finally {
    db.close()
  }
}

export async function deletePhotos(ids) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    ;(ids || []).forEach((id) => store.delete(id))
    await txDone(t)
  } finally {
    db.close()
  }
}
