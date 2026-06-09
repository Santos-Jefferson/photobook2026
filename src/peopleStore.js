// Local store for "people" — named faces the user tags in Explore. Each person
// keeps a small round avatar (a cropped face, or a chosen photo) plus a name.
// Kept in IndexedDB alongside the photo library. Automatic same-person grouping
// across photos needs a face-recognition model; here grouping is by the name the
// user gives a face, which is reliable and works offline.

const DB_NAME = 'photobook_people'
const VERSION = 1
const STORE = 'people'

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

// Newest first. Each: { id, name, thumb (dataURL), count, createdAt }
export async function listPeople() {
  const db = await openDb()
  try {
    const all = await reqDone(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
    return all.sort((a, b) => a.createdAt - b.createdAt)
  } finally {
    db.close()
  }
}

export async function savePerson({ id, name, thumb }) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    const existing = id ? await reqDone(store.get(id)) : null
    const rec = existing
      ? { ...existing, name, thumb: thumb || existing.thumb }
      : {
          id: 'pp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          name,
          thumb: thumb || '',
          createdAt: Date.now(),
        }
    store.put(rec)
    await txDone(t)
    return rec
  } finally {
    db.close()
  }
}

export async function deletePerson(id) {
  const db = await openDb()
  try {
    const t = db.transaction(STORE, 'readwrite')
    t.objectStore(STORE).delete(id)
    await txDone(t)
  } finally {
    db.close()
  }
}
