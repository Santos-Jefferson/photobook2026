import { useEffect, useRef, useState } from 'react'
import { listMemories, saveMemory, deleteMemory } from '../memoryStore'
import { fileToOrientedBase64 } from '../api'
import { readPhotoMeta, metaToStored } from '../metadata'
import { MIN_PHOTOS, MAX_PHOTOS } from '../config'

const MAX_MEMORY_PHOTOS = 8

// A Capsyl-style "Memories" gallery built from the user's own memories: each a
// cluster of their photos summarized by a single title. Opening one offers
// "Create photobook".
export default function Memories({ onCreate, onBack }) {
  const [mine, setMine] = useState(null) // null = loading
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)

  async function refresh() {
    try {
      setMine(await listMemories())
    } catch {
      setMine([])
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  if (creating) {
    return (
      <NewMemory
        onCancel={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          refresh()
        }}
      />
    )
  }

  if (selected) {
    return <MemoryDetail memory={selected} onBack={() => setSelected(null)} onCreate={onCreate} />
  }

  async function remove(e, id) {
    e.stopPropagation()
    if (!window.confirm('Delete this memory?')) return
    await deleteMemory(id)
    refresh()
  }

  const items = mine || []

  return (
    <div className="memories">
      <header className="memories-head">
        <button className="memories-back" onClick={onBack}>
          ‹ Back
        </button>
        <h1>Memories</h1>
        <span className="memories-count">{items.length}</span>
      </header>
      <p className="memories-sub">Group photos from one moment into a memory, then turn it into a story.</p>

      <div className="memories-grid">
        <button className="memory-card memory-new" onClick={() => setCreating(true)}>
          <span className="memory-new-plus">＋</span>
          <span>New memory</span>
        </button>

        {items.map((m) => (
          <button key={m.id} className="memory-card" onClick={() => setSelected(m)}>
            <img src={m.photos[0]} alt="" />
            <div className="memory-card-scrim" />
            <div className="memory-card-text">
              <span className="memory-card-title">{m.title}</span>
              <span className="memory-card-date">
                {m.photos.length} photos · {m.dateRange}
              </span>
            </div>
            <span className="memory-del" role="button" onClick={(e) => remove(e, m.id)}>
              🗑
            </span>
          </button>
        ))}
      </div>

      {mine && items.length === 0 && (
        <p className="memories-empty">No memories yet — tap “New memory” to create your first one.</p>
      )}
    </div>
  )
}

function MemoryDetail({ memory, onBack, onCreate }) {
  return (
    <div className="memory-detail">
      <header className="memories-head">
        <button className="memories-back" onClick={onBack}>
          ‹ Memories
        </button>
      </header>

      <div className="memory-hero">
        <img src={memory.photos[0]} alt="" />
        <div className="memory-hero-scrim" />
        <div className="memory-hero-text">
          <span className="memory-hero-title">{memory.title}</span>
          <span className="memory-hero-date">
            {memory.photos.length} photos · {memory.dateRange}
          </span>
        </div>
      </div>

      <div className="memory-thumbs">
        {memory.photos.map((t, i) => (
          <img key={i} src={t} alt={`Photo ${i + 1}`} />
        ))}
      </div>

      {(() => {
        const n = memory.photos.length
        const tooFew = n < MIN_PHOTOS
        const note = tooFew
          ? `A photobook needs at least ${MIN_PHOTOS} photos.`
          : n > MAX_PHOTOS
            ? `Uses the first ${MAX_PHOTOS} of ${n} photos.`
            : ''
        return (
          <>
            {note && <p className={`memory-book-note ${tooFew ? 'warn' : ''}`}>{note}</p>}
            <button className="memory-create" disabled={tooFew} onClick={() => onCreate(memory)}>
              ✨ Create photobook
            </button>
          </>
        )
      })()}
    </div>
  )
}

function NewMemory({ onCancel, onSaved }) {
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
