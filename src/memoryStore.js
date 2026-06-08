// Local store for user-created memories — a cluster of the user's own photos
// summarized by a title, mirroring a Capsyl Memory. Kept in its own IndexedDB
// database (photos are base64 data URLs, too large for localStorage). These
// appear in the Memories gallery alongside the built-in examples.

const DB_NAME = 'photobook_memories'
const VERSION = 1
const STORE = 'memories'

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

// Newest first. Each: { id, title, dateRange, photos: [dataURL], createdAt }
export async function listMemories() {
  const db = await openDb()
  try {
    const all = await reqDone(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
    return all.sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    db.close()
  }
}

export async function saveMemory({ title, photos }) {
  const id = 'mem_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  const createdAt = Date.now()
  const dateRange = new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const record = { id, title: title || 'My memory', photos: photos || [], dateRange, createdAt, isUser: true }
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).put(record)
    await txDone(t)
    return record
  } finally {
    db.close()
  }
}

export async function deleteMemory(id) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(id)
    await txDone(t)
  } finally {
    db.close()
  }
}
