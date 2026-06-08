import { useEffect, useMemo, useRef, useState } from 'react'
import { MEMORIES, memoryCoverImage, buildMemoryFiles } from '../demoMemory'
import { listMemories, saveMemory, deleteMemory } from '../memoryStore'
import { fileToOrientedBase64 } from '../api'

const MAX_MEMORY_PHOTOS = 8

// A Capsyl-style "Memories" gallery: a grid of cards, each a themed cluster of
// photos summarized by a single title + date range. Users can create their own
// memory from their photos; opening any memory offers "Create photobook".
export default function Memories({ onCreate, onBack }) {
  const covers = useMemo(() => Object.fromEntries(MEMORIES.map((m) => [m.id, memoryCoverImage(m)])), [])
  const [mine, setMine] = useState([])
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
    return (
      <MemoryDetail
        memory={selected}
        cover={selected.isUser ? selected.photos[0] : covers[selected.id]}
        onBack={() => setSelected(null)}
        onCreate={onCreate}
      />
    )
  }

  async function remove(e, id) {
    e.stopPropagation()
    if (!window.confirm('Delete this memory?')) return
    await deleteMemory(id)
    refresh()
  }

  return (
    <div className="memories">
      <header className="memories-head">
        <button className="memories-back" onClick={onBack}>
          ‹ Back
        </button>
        <h1>Memories</h1>
        <span className="memories-count">{mine.length + MEMORIES.length}</span>
      </header>
      <p className="memories-sub">Pick a memory to turn its photos into a story — or create your own.</p>

      <div className="memories-grid">
        <button className="memory-card memory-new" onClick={() => setCreating(true)}>
          <span className="memory-new-plus">＋</span>
          <span>New memory</span>
        </button>

        {mine.map((m) => (
          <button key={m.id} className="memory-card" onClick={() => setSelected(m)}>
            <img src={m.photos[0]} alt="" />
            <div className="memory-card-scrim" />
            <div className="memory-card-text">
              <span className="memory-card-title">{m.title}</span>
              <span className="memory-card-date">{m.photos.length} photos · {m.dateRange}</span>
            </div>
            <span className="memory-mine-badge">mine</span>
            <span className="memory-del" role="button" onClick={(e) => remove(e, m.id)}>
              🗑
            </span>
          </button>
        ))}

        {MEMORIES.map((m) => (
          <button key={m.id} className="memory-card" onClick={() => setSelected(m)}>
            <img src={covers[m.id]} alt="" />
            <div className="memory-card-scrim" />
            <div className="memory-card-text">
              <span
                className="memory-card-title"
                style={{ fontFamily: m.font, textTransform: m.uppercase ? 'uppercase' : 'none' }}
              >
                {m.title}
              </span>
              <span className="memory-card-date">{m.dateRange}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function MemoryDetail({ memory, cover, onBack, onCreate }) {
  const [thumbs, setThumbs] = useState(memory.isUser ? memory.photos : null)

  useEffect(() => {
    if (memory.isUser) return
    let urls = []
    let cancelled = false
    buildMemoryFiles(memory).then((files) => {
      if (cancelled) return
      urls = files.map((f) => URL.createObjectURL(f))
      setThumbs(urls)
    })
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [memory])

  return (
    <div className="memory-detail">
      <header className="memories-head">
        <button className="memories-back" onClick={onBack}>
          ‹ Memories
        </button>
      </header>

      <div className="memory-hero">
        <img src={cover} alt="" />
        <div className="memory-hero-scrim" />
        <div className="memory-hero-text">
          <span
            className="memory-hero-title"
            style={{ fontFamily: memory.font, textTransform: memory.uppercase ? 'uppercase' : 'none' }}
          >
            {memory.title}
          </span>
          <span className="memory-hero-date">
            {(memory.isUser ? memory.photos.length : memory.scenes.length)} photos · {memory.dateRange}
          </span>
        </div>
      </div>

      {memory.context && <p className="memory-desc">{memory.context}</p>}

      <div className="memory-thumbs">
        {(thumbs || memory.scenes).map((t, i) =>
          thumbs ? (
            <img key={i} src={t} alt={`Photo ${i + 1}`} />
          ) : (
            <div key={i} className="memory-thumb-skeleton" />
          ),
        )}
      </div>

      <button className="memory-create" onClick={() => onCreate(memory)}>
        ✨ Create photobook
      </button>
    </div>
  )
}

function NewMemory({ onCancel, onSaved }) {
  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState([]) // data URLs
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  async function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) return
    setBusy(true)
    try {
      const room = MAX_MEMORY_PHOTOS - photos.length
      const b64s = await Promise.all(incoming.slice(0, room).map((f) => fileToOrientedBase64(f)))
      setPhotos((prev) => [...prev, ...b64s.map((b) => 'data:image/jpeg;base64,' + b)])
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!photos.length || busy) return
    setBusy(true)
    try {
      await saveMemory({ title: title.trim() || 'My memory', photos })
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

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      <div className="memory-thumbs new">
        {photos.map((p, i) => (
          <div key={i} className="memory-new-thumb">
            <img src={p} alt={`Photo ${i + 1}`} />
            <button className="memory-new-remove" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}>
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
