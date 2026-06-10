import { useEffect, useRef, useState } from 'react'
import { listPhotos, addPhotos, setFavorite, deletePhotos, updatePhotoImage } from '../photoStore'
import { fileToOrientedBase64 } from '../api'
import { readPhotoMeta, metaToStored } from '../metadata'
import { MIN_PHOTOS, MAX_PHOTOS } from '../config'
import PhotoChat from './PhotoChat'

// Clean line icons, in the spirit of Capsyl's wl-icon set, so the toolbars read
// like the real app rather than emoji.
const Icon = ({ name }) => {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'book':
      return (
        <svg {...common}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 1 4 18zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 0 20 18z" /></svg>
      )
    case 'share':
      return (
        <svg {...common}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.3M8.2 13.2l7.6 4.3" /></svg>
      )
    case 'heart':
      return (
        <svg {...common} fill="none"><path d="M12 20s-7-4.5-9.3-9C1.2 8.3 2.6 5 5.8 5 8 5 9.4 6.7 12 9.5 14.6 6.7 16 5 18.2 5c3.2 0 4.6 3.3 3.1 6-2.3 4.5-9.3 9-9.3 9z" /></svg>
      )
    case 'heart-fill':
      return (
        <svg {...common} fill="currentColor" stroke="currentColor"><path d="M12 20s-7-4.5-9.3-9C1.2 8.3 2.6 5 5.8 5 8 5 9.4 6.7 12 9.5 14.6 6.7 16 5 18.2 5c3.2 0 4.6 3.3 3.1 6-2.3 4.5-9.3 9-9.3 9z" /></svg>
      )
    case 'trash':
      return (
        <svg {...common}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.8H8.7a2 2 0 0 1-2-1.8L6 7" /></svg>
      )
    case 'add':
      return (
        <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
      )
    case 'album':
      return (
        <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="M3.5 15l4.5-4 3.5 3 4-5 5 6.5" /><circle cx="9" cy="8.5" r="1.4" /></svg>
      )
    case 'info':
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6h.01" /></svg>
      )
    case 'chat':
      return (
        <svg {...common}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4.5 4z" /></svg>
      )
    case 'back':
      return (
        <svg {...common}><path d="M15 5l-7 7 7 7" /></svg>
      )
    case 'select':
      return (
        <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.4 2.4L15.5 9.8" /></svg>
      )
    case 'check':
      return (
        <svg {...common} strokeWidth="2.4"><path d="m5 12.5 4 4 10-10" /></svg>
      )
    default:
      return null
  }
}

// Capsyl-style "Photos" library. A tight photo grid with a subheader toolbar.
// Tapping a photo opens a maximized detail view (with a "Chat or book" entry);
// the multi-select mode reveals an action bar whose primary action is
// "Create photobook", alongside favorite / share / delete.
export default function Photos({ onBack, onCreatePhotobook, initialFavOnly = false }) {
  const [photos, setPhotos] = useState(null) // null = loading
  const [favOnly, setFavOnly] = useState(initialFavOnly)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [notice, setNotice] = useState('') // hint shown above the action bar
  const [detail, setDetail] = useState(null) // open photo (detail view)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  // Enter multi-select, optionally pre-selecting a photo with a guiding hint.
  function startSelect(preselectId, hint) {
    setSelectMode(true)
    setSelected(new Set(preselectId ? [preselectId] : []))
    setNotice(hint || '')
  }

  async function refresh() {
    try {
      setPhotos(await listPhotos())
    } catch {
      setPhotos([])
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  async function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    if (!incoming.length) return
    setBusy(true)
    try {
      // Read EXIF (date/GPS) from the original file BEFORE re-encoding, which
      // strips it — that's how we keep date/location context for generation.
      const items = await Promise.all(
        incoming.map(async (f) => {
          const meta = metaToStored(await readPhotoMeta(f))
          const b64 = await fileToOrientedBase64(f)
          return { url: 'data:image/jpeg;base64,' + b64, meta }
        }),
      )
      await addPhotos(items)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  function toggleSelect(id) {
    setNotice('') // once they start picking, the live 2–5 hint takes over
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitSelect() {
    setSelectMode(false)
    setSelected(new Set())
    setNotice('')
  }

  const all = photos || []
  const shown = favOnly ? all.filter((p) => p.favorite) : all
  const selectedPhotos = all.filter((p) => selected.has(p.id))
  const count = selected.size
  const bookReady = count >= MIN_PHOTOS && count <= MAX_PHOTOS
  // What to tell the user about the 2–5 rule for the current selection.
  const bookHint = notice
    ? notice
    : count < MIN_PHOTOS
      ? `Select at least ${MIN_PHOTOS} photos for a photobook.`
      : count > MAX_PHOTOS
        ? `A photobook holds up to ${MAX_PHOTOS} photos — deselect ${count - MAX_PHOTOS}.`
        : `${count} photos — ready to create.`

  // ----- Maximized photo detail view -----
  if (detail) {
    const live = all.find((p) => p.id === detail.id) || detail
    return (
      <PhotoDetail
        photo={live}
        onBack={() => setDetail(null)}
        onToggleFavorite={async () => {
          await setFavorite(live.id, !live.favorite)
          refresh()
        }}
        onDelete={async () => {
          if (!window.confirm('Delete this photo?')) return
          await deletePhotos([live.id])
          setDetail(null)
          refresh()
        }}
        onCreateBook={() => {
          // A book needs 2–5 photos, so from a single photo we drop into
          // multi-select with this one pre-picked and a hint to add more.
          setDetail(null)
          startSelect(live.id, `Pick ${MIN_PHOTOS - 1}–${MAX_PHOTOS - 1} more photos — a photobook uses ${MIN_PHOTOS}–${MAX_PHOTOS}.`)
        }}
        onImageEdited={async (url) => {
          await updatePhotoImage(live.id, url)
          refresh()
        }}
      />
    )
  }

  return (
    <div className="photos">
      <header className="photos-head">
        {selectMode ? (
          <>
            <button className="photos-head-btn" onClick={exitSelect}>
              Cancel
            </button>
            <h1>{selected.size ? `${selected.size} selected` : 'Select photos'}</h1>
            <span className="photos-head-spacer" />
          </>
        ) : (
          <>
            <button className="photos-head-btn icon" onClick={onBack} aria-label="Back">
              <Icon name="back" />
            </button>
            <h1>Photos</h1>
            <span className="photos-head-spacer" />
          </>
        )}
      </header>

      {/* Subheader toolbar — favorite filter, select toggle, upload. */}
      {!selectMode && (
        <div className="photos-toolbar">
          <button
            className={`photos-tool ${favOnly ? 'on' : ''}`}
            onClick={() => setFavOnly((v) => !v)}
            title="Show favorites only"
          >
            <Icon name={favOnly ? 'heart-fill' : 'heart'} />
          </button>
          <span className="photos-tool-spacer" />
          <button
            className="photos-tool"
            onClick={() => setSelectMode(true)}
            disabled={!all.length}
            title="Select"
          >
            <Icon name="select" />
            <span className="photos-tool-label">Select</span>
          </button>
          <button className="photos-tool" onClick={() => fileInput.current?.click()} title="Add photos">
            <Icon name="add" />
            <span className="photos-tool-label">Add</span>
          </button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Grid */}
      {photos && shown.length === 0 ? (
        <div className="photos-empty">
          <p>{favOnly ? 'No favorites yet.' : 'Your photos live here.'}</p>
          {!favOnly && (
            <button className="photos-empty-add" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? 'Adding…' : '＋ Add photos'}
            </button>
          )}
        </div>
      ) : (
        <div className="photos-grid">
          {shown.map((p) => {
            const sel = selected.has(p.id)
            return (
              <button
                key={p.id}
                className={`photo-cell ${sel ? 'selected' : ''}`}
                onClick={() => (selectMode ? toggleSelect(p.id) : setDetail(p))}
              >
                <img src={p.url} alt="" loading="lazy" />
                {p.favorite && !selectMode && (
                  <span className="photo-cell-fav">
                    <Icon name="heart-fill" />
                  </span>
                )}
                {selectMode && (
                  <span className={`photo-cell-check ${sel ? 'on' : ''}`}>{sel && <Icon name="check" />}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Multi-select action bar — Create photobook is the primary action. */}
      {selectMode && (
        <div className="photos-actionbar">
          <div className={`photos-actionbar-hint ${count && !bookReady ? 'warn' : ''}`}>{bookHint}</div>
          <div className="photos-actionbar-row">
          <button
            className="photos-action primary"
            disabled={!bookReady}
            onClick={() => onCreatePhotobook(selectedPhotos.map((p) => ({ url: p.url, meta: p.meta })), 'My photos')}
          >
            <Icon name="book" />
            <span>Create photobook</span>
          </button>
          <button
            className="photos-action"
            disabled={!selected.size}
            onClick={async () => {
              const anyUnfav = selectedPhotos.some((p) => !p.favorite)
              await Promise.all(selectedPhotos.map((p) => setFavorite(p.id, anyUnfav)))
              refresh()
            }}
          >
            <Icon name="heart" />
            <span>Favorite</span>
          </button>
          <button
            className="photos-action"
            disabled={!selected.size}
            onClick={() => shareSelected(selectedPhotos)}
          >
            <Icon name="share" />
            <span>Share</span>
          </button>
          <button
            className="photos-action danger"
            disabled={!selected.size}
            onClick={async () => {
              if (!window.confirm(`Delete ${selected.size} photo(s)?`)) return
              await deletePhotos([...selected])
              exitSelect()
              refresh()
            }}
          >
            <Icon name="trash" />
            <span>Delete</span>
          </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Best-effort native share of the selected photos; falls back to a notice.
async function shareSelected(items) {
  try {
    const files = await Promise.all(
      items.slice(0, 10).map(async (p, i) => {
        const blob = await (await fetch(p.url)).blob()
        return new File([blob], `photo-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' })
      }),
    )
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title: 'Photos' })
      return
    }
  } catch {
    /* user cancelled or unsupported */
  }
  if (!navigator.share) window.alert('Sharing photos isn’t supported on this device.')
}

// The maximized single-photo view: full-bleed photo, a top bar, a bottom
// toolbar (add to album / favorite / share / info), and a prominent
// "Chat or book" entry that opens the editor chat or starts a photobook.
function PhotoDetail({ photo, onBack, onToggleFavorite, onDelete, onCreateBook, onImageEdited }) {
  const [sheet, setSheet] = useState(false) // "Chat or book" chooser
  const [chat, setChat] = useState(false)
  const [info, setInfo] = useState(false)

  async function share() {
    try {
      const blob = await (await fetch(photo.url)).blob()
      const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Photo' })
        return
      }
    } catch {
      /* cancelled / unsupported */
    }
    if (!navigator.share) window.alert('Sharing isn’t supported on this device.')
  }

  return (
    <div className="photo-detail">
      <div className="photo-detail-top">
        <button className="pd-icon" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
        <span className="photo-detail-top-spacer" />
        <button className="pd-icon" onClick={onToggleFavorite} aria-label="Favorite">
          <Icon name={photo.favorite ? 'heart-fill' : 'heart'} />
        </button>
        <button className="pd-icon" onClick={onDelete} aria-label="Delete">
          <Icon name="trash" />
        </button>
      </div>

      <div className="photo-detail-stage" onClick={() => setSheet(false)}>
        <img src={photo.url} alt="" />
      </div>

      {info && (
        <div className="photo-detail-info">
          <span>Added {new Date(photo.createdAt).toLocaleString()}</span>
          {photo.favorite && <span>★ Favorite</span>}
        </div>
      )}

      <div className="photo-detail-bar">
        <button className="pd-tool" onClick={() => alert('Pick an album to add this photo to.')}>
          <Icon name="album" />
          <span>Album</span>
        </button>
        <button className="pd-tool" onClick={share}>
          <Icon name="share" />
          <span>Share</span>
        </button>
        {/* The new "Chat or book" entry point. */}
        <button className="pd-tool accent" onClick={() => setSheet((s) => !s)}>
          <Icon name="chat" />
          <span>Chat or book</span>
        </button>
        <button className={`pd-tool ${info ? 'on' : ''}`} onClick={() => setInfo((v) => !v)}>
          <Icon name="info" />
          <span>Info</span>
        </button>
      </div>

      {/* Chooser sheet: chat about the photo, or turn it into a photobook. */}
      {sheet && (
        <div className="pd-sheet" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="pd-sheet-card">
            <span className="pd-sheet-grip" />
            <button
              className="pd-sheet-opt"
              onClick={() => {
                setSheet(false)
                setChat(true)
              }}
            >
              <Icon name="chat" />
              <span>
                <strong>Chat about this photo</strong>
                <small>Edit it, restyle it, write a caption or card</small>
              </span>
            </button>
            <button
              className="pd-sheet-opt"
              onClick={() => {
                setSheet(false)
                onCreateBook()
              }}
            >
              <Icon name="book" />
              <span>
                <strong>Create a photobook</strong>
                <small>Spin this photo into a narrated story</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Reuse the existing photo-chat editor for this single photo. */}
      {chat && (
        <div className="pd-chat-overlay" onClick={() => setChat(false)}>
          <PhotoChat
            photo={photo.url}
            caption=""
            narrative=""
            storyContext=""
            standalone
            canRevert={false}
            onRevert={() => {}}
            onApplyImage={(b64) => {
              const url = b64 && b64.startsWith('data:') ? b64 : 'data:image/png;base64,' + b64
              onImageEdited(url)
            }}
            onApplyText={() => {}}
            onClose={() => setChat(false)}
          />
        </div>
      )}
    </div>
  )
}
