import { useEffect, useRef, useState } from 'react'
import { addPhotos } from '../photoStore'
import { listMemories } from '../memoryStore'
import { listSavedBooks } from '../bookStorage'
import { fileToOrientedBase64 } from '../api'

const NAME_KEY = 'pb_display_name'

// The Capsyl-style top bar shown on every main tab: a search button on the left,
// and on the right a cloud "+" to upload photos plus the user avatar (profile /
// settings). Upload adds straight to the photo library.
export default function TopBar({ onNavigate, onUploaded }) {
  const [search, setSearch] = useState(false)
  const [profile, setProfile] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '')

  async function upload(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) return
    setBusy(true)
    try {
      const b64s = await Promise.all(incoming.map((f) => fileToOrientedBase64(f)))
      await addPhotos(b64s.map((b) => 'data:image/jpeg;base64,' + b))
      onUploaded && onUploaded()
      onNavigate && onNavigate('photos')
    } finally {
      setBusy(false)
    }
  }

  const hello = name ? `Hi, ${name.split(' ')[0]}` : 'Hello !'

  return (
    <header className="topbar">
      <button className="topbar-search" aria-label="Search" onClick={() => setSearch(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="topbar-right">
        <button
          className={`topbar-cloud ${busy ? 'busy' : ''}`}
          aria-label="Upload photos"
          onClick={() => fileInput.current?.click()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M11.73 5a5.82 5.82 0 0 0-3.21 1 7 7 0 0 0-2.95 4.59A4.09 4.09 0 0 0 2 14.78 4.05 4.05 0 0 0 5.86 19H17.2a5.14 5.14 0 0 0 4.8-5.41 5.09 5.09 0 0 0-4.78-5.28h-.13A6.2 6.2 0 0 0 11.73 5Z"
            />
          </svg>
          <span className="topbar-cloud-plus">+</span>
        </button>
        <span className="topbar-divider" />
        <button className="topbar-user" onClick={() => setProfile(true)}>
          <span className="topbar-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="9" r="4" fill="currentColor" />
              <path fill="currentColor" d="M4 20a8 8 0 0 1 16 0Z" />
            </svg>
          </span>
          <span className="topbar-hello">{hello}</span>
          <span className="topbar-caret">⌄</span>
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          upload(e.target.files)
          e.target.value = ''
        }}
      />

      {search && <SearchOverlay onNavigate={onNavigate} onClose={() => setSearch(false)} />}
      {profile && (
        <ProfileSheet
          name={name}
          onSave={(v) => {
            setName(v)
            v ? localStorage.setItem(NAME_KEY, v) : localStorage.removeItem(NAME_KEY)
          }}
          onClose={() => setProfile(false)}
        />
      )}
    </header>
  )
}

// Lightweight search across the user's memories and saved photobooks by title.
function SearchOverlay({ onNavigate, onClose }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [mems, books] = await Promise.all([listMemories().catch(() => []), listSavedBooks().catch(() => [])])
      if (!alive) return
      setItems([
        ...mems.map((m) => ({ kind: 'memory', view: 'memories', title: m.title, thumb: m.photos?.[0] })),
        ...books.map((b) => ({ kind: 'photobook', view: 'saved', title: b.title, thumb: b.cover })),
      ])
    })()
    return () => {
      alive = false
    }
  }, [])

  const ql = q.trim().toLowerCase()
  const results = ql ? items.filter((i) => (i.title || '').toLowerCase().includes(ql)) : items

  return (
    <div className="tb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tb-search-panel">
        <div className="tb-search-row">
          <input
            autoFocus
            type="text"
            value={q}
            placeholder="Search memories and photobooks…"
            onChange={(e) => setQ(e.target.value)}
          />
          <button onClick={onClose}>Cancel</button>
        </div>
        <div className="tb-search-results">
          {results.length === 0 && <p className="tb-search-empty">Nothing matches “{q}”.</p>}
          {results.map((r, i) => (
            <button
              key={i}
              className="tb-search-item"
              onClick={() => {
                onClose()
                onNavigate && onNavigate(r.view)
              }}
            >
              {r.thumb ? <img src={r.thumb} alt="" /> : <span className="tb-search-thumb-blank" />}
              <span className="tb-search-item-text">
                <strong>{r.title}</strong>
                <small>{r.kind}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProfileSheet({ name, onSave, onClose }) {
  const [val, setVal] = useState(name)
  return (
    <div className="tb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tb-profile">
        <span className="pd-sheet-grip" />
        <div className="tb-profile-head">
          <span className="topbar-avatar big" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="9" r="4" fill="currentColor" />
              <path fill="currentColor" d="M4 20a8 8 0 0 1 16 0Z" />
            </svg>
          </span>
          <strong>Your profile</strong>
        </div>
        <label className="tb-profile-field">
          <span>Display name</span>
          <input type="text" value={val} maxLength={40} placeholder="Your name" onChange={(e) => setVal(e.target.value)} />
        </label>
        <button
          className="tb-profile-save"
          onClick={() => {
            onSave(val.trim())
            onClose()
          }}
        >
          Save
        </button>
        <p className="tb-profile-note">Profile &amp; settings are saved on this device only.</p>
      </div>
    </div>
  )
}
