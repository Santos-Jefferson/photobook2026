import { useEffect, useMemo, useState } from 'react'
import { MEMORIES, memoryCoverImage, buildMemoryFiles } from '../demoMemory'

// A Capsyl-style "Memories" gallery: a grid of cards, each one a themed cluster
// of photos summarized by a single title + date range. Opening a memory shows
// its photos and a "Create photobook" action that generates a story from it.
export default function Memories({ onCreate, onBack }) {
  const covers = useMemo(() => Object.fromEntries(MEMORIES.map((m) => [m.id, memoryCoverImage(m)])), [])
  const [selected, setSelected] = useState(null)

  if (selected) {
    return <MemoryDetail memory={selected} cover={covers[selected.id]} onBack={() => setSelected(null)} onCreate={onCreate} />
  }

  return (
    <div className="memories">
      <header className="memories-head">
        <button className="memories-back" onClick={onBack}>
          ‹ Back
        </button>
        <h1>Memories</h1>
        <span className="memories-count">{MEMORIES.length}</span>
      </header>
      <p className="memories-sub">Pick a memory to turn its photos into a story.</p>

      <div className="memories-grid">
        {MEMORIES.map((m) => (
          <button key={m.id} className="memory-card" onClick={() => setSelected(m)}>
            <img src={covers[m.id]} alt="" />
            <div className="memory-card-scrim" />
            <div className="memory-card-text">
              <span className="memory-card-title" style={{ fontFamily: m.font, textTransform: m.uppercase ? 'uppercase' : 'none' }}>
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
  const [thumbs, setThumbs] = useState(null)

  useEffect(() => {
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
          <span className="memory-hero-title" style={{ fontFamily: memory.font, textTransform: memory.uppercase ? 'uppercase' : 'none' }}>
            {memory.title}
          </span>
          <span className="memory-hero-date">
            {memory.scenes.length} photos · {memory.dateRange}
          </span>
        </div>
      </div>

      <p className="memory-desc">{memory.context}</p>

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
