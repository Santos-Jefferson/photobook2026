import { useEffect, useState } from 'react'
import { listSavedBooks, getSavedBook, deleteSavedBook } from '../bookStorage'

// The "Saved photobooks" library: a grid of everything the user has saved, with
// open + delete. Books live in IndexedDB; opening one loads the full book and
// hands it back to App to render in the StoryViewer.
export default function SavedBooks({ onOpen, onBack }) {
  const [items, setItems] = useState(null) // null = loading
  const [busyId, setBusyId] = useState('')

  async function refresh() {
    try {
      setItems(await listSavedBooks())
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function open(id) {
    setBusyId(id)
    try {
      const book = await getSavedBook(id)
      if (book) onOpen(book, id)
    } finally {
      setBusyId('')
    }
  }

  async function remove(e, id) {
    e.stopPropagation()
    if (!window.confirm('Delete this saved photobook?')) return
    await deleteSavedBook(id)
    refresh()
  }

  return (
    <div className="saved">
      <header className="saved-head">
        <button className="saved-back" onClick={onBack}>
          ‹ Back
        </button>
        <h1>Saved photobooks</h1>
        <span className="muted">{items ? `${items.length}` : ''}</span>
      </header>

      {items === null && <p className="muted saved-note">Loading…</p>}

      {items && items.length === 0 && (
        <div className="saved-empty">
          <div className="saved-empty-ico" aria-hidden="true">
            📚
          </div>
          <p>No saved photobooks yet.</p>
          <span className="muted">Open a story and tap “Save” to keep it here.</span>
          <button className="cta" onClick={onBack}>
            Create one
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="saved-grid">
          {items.map((it) => (
            <figure key={it.id} className="saved-card" onClick={() => open(it.id)}>
              <div className="saved-cover">
                {it.cover ? <img src={it.cover} alt="" /> : <div className="saved-cover-blank">📖</div>}
                {busyId === it.id && <div className="saved-cover-busy">Opening…</div>}
              </div>
              <figcaption>
                <strong>{it.title}</strong>
                <span className="muted">
                  {it.pageCount} {it.pageCount === 1 ? 'page' : 'pages'} · {formatDate(it.savedAt)}
                </span>
              </figcaption>
              <button className="saved-del" aria-label="Delete" onClick={(e) => remove(e, it.id)}>
                🗑
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}
