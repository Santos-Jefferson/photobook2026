import { useEffect, useState } from 'react'
import { listMemories, deleteMemory } from '../memoryStore'
import { MIN_PHOTOS, MAX_PHOTOS } from '../config'

// A Capsyl-style "Memories" gallery built from the user's own memories: each a
// cluster of their photos summarized by a single title. Opening one offers
// "Create photobook". (Creating a memory lives behind the user profile.)
export default function Memories({ onCreate, onBack }) {
  const [mine, setMine] = useState(null) // null = loading
  const [selected, setSelected] = useState(null)

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
      <p className="memories-sub">Open a memory to turn it into a narrated photobook.</p>

      <div className="memories-grid">
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
        <p className="memories-empty">No memories yet.</p>
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
