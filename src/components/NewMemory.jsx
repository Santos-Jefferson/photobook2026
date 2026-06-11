import { useRef, useState } from 'react'
import { saveMemory } from '../memoryStore'
import { fileToOrientedBase64 } from '../api'
import { readPhotoMeta, metaToStored } from '../metadata'

const MAX_MEMORY_PHOTOS = 8

// Create a new memory (a cluster of photos summarized by a title). Capsyl doesn't
// expose this today, so for the MVP it lives behind the user profile rather than
// in the Memories gallery. Captures EXIF (date/GPS) per photo for richer context.
export default function NewMemory({ onCancel, onSaved }) {
  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState([]) // data URLs
  const [metas, setMetas] = useState([]) // stored EXIF, aligned to photos
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  async function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) return
    setBusy(true)
    try {
      const room = MAX_MEMORY_PHOTOS - photos.length
      const added = await Promise.all(
        incoming.slice(0, room).map(async (f) => {
          const meta = metaToStored(await readPhotoMeta(f))
          const b64 = await fileToOrientedBase64(f)
          return { url: 'data:image/jpeg;base64,' + b64, meta }
        }),
      )
      setPhotos((prev) => [...prev, ...added.map((a) => a.url)])
      setMetas((prev) => [...prev, ...added.map((a) => a.meta)])
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!photos.length || busy) return
    setBusy(true)
    try {
      await saveMemory({ title: title.trim() || 'My memory', photos, metas })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="memories">
      <header className="memories-head">
        <button className="memories-back" onClick={onCancel}>
          ‹ Cancel
        </button>
        <h1>New memory</h1>
      </header>
      <p className="memories-sub">Give it a title and add a few photos from the same moment.</p>

      <input
        className="memory-title-input"
        type="text"
        value={title}
        placeholder="Memory title — e.g. Sofia's first birthday"
        maxLength={80}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />

      <div className="memory-thumbs new">
        {photos.map((p, i) => (
          <div key={i} className="memory-new-thumb">
            <img src={p} alt={`Photo ${i + 1}`} />
            <button
              className="memory-new-remove"
              onClick={() => {
                setPhotos((prev) => prev.filter((_, j) => j !== i))
                setMetas((prev) => prev.filter((_, j) => j !== i))
              }}
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < MAX_MEMORY_PHOTOS && (
          <button className="memory-new-add" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? '…' : '＋'}
          </button>
        )}
      </div>

      <button className="memory-create" disabled={!photos.length || busy} onClick={save}>
        {busy ? 'Working…' : `Save memory${photos.length ? ` (${photos.length})` : ''}`}
      </button>
    </div>
  )
}
