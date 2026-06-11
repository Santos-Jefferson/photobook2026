import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VIBES, STYLES, MAX_PHOTOS, PERSPECTIVES } from '../config'
import { fileToOrientedBase64, getApiUrl, setApiUrl, getApiKey, setApiKey } from '../api'
import { readPhotoMeta, summarizePhotoMeta } from '../metadata'
import { listPhotos } from '../photoStore'
import { analyzeAlbum } from '../insightsClient'

let uid = 0

// Stored EXIF ({ t, lat, lon }) → the shape summarizePhotoMeta expects.
function storedToMeta(s) {
  return s ? { date: s.t ? new Date(s.t) : null, latitude: s.lat, longitude: s.lon } : {}
}

export default function Creator({ onGenerate, error, buildPayload, onOpenSaved, onOpenMemories, onOpenPhotos }) {
  const [photos, setPhotos] = useState([]) // { id, file, url }
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [vibe, setVibe] = useState(VIBES[0])
  const [perspective, setPerspective] = useState(PERSPECTIVES[0].code)
  const [style, setStyle] = useState(STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0])
  const [stylize, setStylize] = useState(true)
  const [bedtime, setBedtime] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState(false) // "Choose from Photos" library picker

  // EXIF-derived context (date/time/place) extracted from the uploaded photos.
  const [photoMeta, setPhotoMeta] = useState({ summary: '', place: '', hasData: false })
  const [includeMeta, setIncludeMeta] = useState(true)

  // API endpoint/key come from env or saved settings (no in-page settings UI).
  const [apiUrl] = useState(getApiUrl())
  const [apiKey] = useState(getApiKey())
  const [demo] = useState(!getApiUrl())

  // AI album analysis: auto title/context + "What we noticed" insights.
  const [insights, setInsights] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const titleTouched = useRef(false)
  const contextTouched = useRef(false)

  const fileInput = useRef(null)
  const dragIndex = useRef(null)

  async function analyze() {
    if (!photos.length || analyzing) return
    setAnalyzing(true)
    try {
      // analyzeAlbum needs data/http URLs; uploaded items are blob URLs, so
      // convert those to data URLs first.
      const urls = await Promise.all(photos.map((p) => (p.file ? fileToDataUrl(p.file) : Promise.resolve(p.url))))
      const r = await analyzeAlbum(urls)
      if (!r) return
      setInsights(r)
      if (r.title && !titleTouched.current) setTitle(r.title)
      if (r.context && !contextTouched.current) setContext(r.context)
    } finally {
      setAnalyzing(false)
    }
  }

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line

  // Extract EXIF (date/time/GPS) whenever the photo set changes, and build a
  // context line from it. Reverse-geocoding is async, so this runs in an effect
  // with cancellation to avoid setting state after a newer change.
  useEffect(() => {
    let cancelled = false
    if (!photos.length) {
      setPhotoMeta({ summary: '', place: '', hasData: false })
      return
    }
    ;(async () => {
      // Uploaded items read EXIF from the File; library items carry stored EXIF.
      const metas = await Promise.all(
        photos.map((p) => (p.file ? readPhotoMeta(p.file) : Promise.resolve(storedToMeta(p.meta)))),
      )
      if (cancelled) return
      const summary = await summarizePhotoMeta(metas)
      if (!cancelled) setPhotoMeta(summary)
    })()
    return () => {
      cancelled = true
    }
  }, [photos])

  function addFiles(fileList) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'))
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length
      const next = incoming.slice(0, room).map((file) => ({
        id: ++uid,
        file,
        url: URL.createObjectURL(file),
      }))
      return [...prev, ...next]
    })
  }

  // Add photos chosen from the existing library (data URLs + stored EXIF).
  function addFromLibrary(items) {
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length
      const next = (items || []).slice(0, room).map((it) => ({ id: ++uid, url: it.url, meta: it.meta || null }))
      return [...prev, ...next]
    })
  }

  function removePhoto(id) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  function reorder(from, to) {
    setPhotos((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })
  }

  async function submit() {
    if (!photos.length || busy) return
    setBusy(true)
    try {
      setApiUrl(demo ? '' : apiUrl)
      setApiKey(apiKey)
      // Uploaded items come from a File; library items are already data URLs.
      const photosBase64 = await Promise.all(
        photos.map((p) => (p.file ? fileToOrientedBase64(p.file) : Promise.resolve(p.url.replace(/^data:[^,]+,/, '')))),
      )
      const previewDataUrls = await Promise.all(
        photos.map((p) => (p.file ? fileToDataUrl(p.file) : Promise.resolve(p.url))),
      )

      // Fold the EXIF-derived details into the context when enabled.
      const baseContext = context.trim()
      const fullContext =
        includeMeta && photoMeta.summary
          ? [baseContext, photoMeta.summary].filter(Boolean).join('\n\n')
          : baseContext

      const payload = buildPayload({
        photosBase64,
        vibe,
        stylizeImages: stylize,
        style,
        title: title.trim(),
        context: fullContext,
        perspective,
      })
      await onGenerate({ payload, previewDataUrls, demo, bedtime })
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = photos.length > 0 && (demo || apiUrl) && !busy

  return (
    <div className="creator">
      <header className="creator-head">
        <h1>
          <span className="logo-dot" /> Photobook
        </h1>
        <p>Pick a few photos, set the mood, and we’ll spin them into a story you can swipe through.</p>
      </header>

      {error && <div className="banner banner-error">{error}</div>}

      {/* Photo picker */}
      <section className="card">
        <div className="card-title">
          <h2>Your photos</h2>
          <span className="muted">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>

        <div
          className={`dropzone ${photos.length ? 'has-photos' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            addFiles(e.dataTransfer.files)
          }}
        >
          {photos.length === 0 ? (
            <div className="dropzone-empty">
              <div className="dropzone-icon">＋</div>
              <p>Tap to choose photos</p>
              <span className="muted">or drag &amp; drop · up to {MAX_PHOTOS}</span>
            </div>
          ) : (
            <div className="thumbs">
              {photos.map((p, i) => (
                <figure
                  key={p.id}
                  className="thumb"
                  draggable
                  onClick={(e) => e.stopPropagation()}
                  onDragStart={() => (dragIndex.current = i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current != null) reorder(dragIndex.current, i)
                    dragIndex.current = null
                  }}
                >
                  <img src={p.url} alt={`Photo ${i + 1}`} />
                  <span className="thumb-order">{i + 1}</span>
                  <button
                    type="button"
                    className="thumb-remove"
                    aria-label="Remove photo"
                    onClick={() => removePhoto(p.id)}
                  >
                    ×
                  </button>
                  <div className="thumb-move">
                    <button type="button" onClick={() => reorder(i, i - 1)} aria-label="Move left">‹</button>
                    <button type="button" onClick={() => reorder(i, i + 1)} aria-label="Move right">›</button>
                  </div>
                </figure>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className="thumb thumb-add" onClick={() => fileInput.current?.click()}>
                  ＋
                </button>
              )}
            </div>
          )}
        </div>
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

        {/* Pick from the existing Photos library instead of uploading. */}
        <div className="creator-pick-row">
          <button type="button" className="creator-pick" onClick={() => fileInput.current?.click()}>
            ⬆️ Upload photos
          </button>
          <button
            type="button"
            className="creator-pick"
            onClick={() => setPicker(true)}
            disabled={photos.length >= MAX_PHOTOS}
          >
            🖼️ Choose from Photos
          </button>
        </div>
      </section>

      {/* AI album insights — also auto-fills title + context below. */}
      {photos.length > 0 && (
        <section className="card insights-card">
          <div className="card-title">
            <h2>✨ What we noticed</h2>
            <button className="insights-regen" onClick={analyze} disabled={analyzing}>
              {analyzing ? 'Analyzing…' : insights ? 'Regenerate' : 'Analyze'}
            </button>
          </div>

          {analyzing && !insights && <p className="insights-loading">Looking through your photos…</p>}

          {!analyzing && !insights && (
            <p className="insights-empty">
              Tap <strong>Analyze</strong> and we’ll suggest a title, context and a few insights from your photos.
            </p>
          )}

          {insights && (
            <div className="insights-body">
              {insights.themes.length > 0 && (
                <div className="insights-themes">
                  {insights.themes.map((t) => (
                    <span key={t} className="insights-tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {insights.mood && (
                <p className="insight-line">
                  <span className="insight-label">Mood</span> {insights.mood}
                </p>
              )}
              {insights.highlight && (
                <p className="insight-line">
                  <span className="insight-label">Highlight</span> {insights.highlight}
                </p>
              )}
              {insights.people && (
                <p className="insight-line">
                  <span className="insight-label">People</span> {insights.people}
                </p>
              )}
              <p className="insights-foot">Title and context below were suggested from these photos — edit them anytime.</p>
            </div>
          )}
        </section>
      )}

      {/* Story options */}
      <section className="card">
        <div className="card-title">
          <h2>The story</h2>
        </div>

        <label className="field">
          <span>Title</span>
          <input
            type="text"
            value={title}
            placeholder="Our trip to Bonneville Salt Flats"
            onChange={(e) => {
              titleTouched.current = true
              setTitle(e.target.value)
            }}
          />
        </label>

        <label className="field">
          <span>Context</span>
          <textarea
            rows={3}
            value={context}
            placeholder="During Memorial Day we went to the Bonneville Salt Flats as a family."
            onChange={(e) => {
              contextTouched.current = true
              setContext(e.target.value)
            }}
          />
        </label>

        {photoMeta.hasData && (
          <label className="meta-hint">
            <input type="checkbox" checked={includeMeta} onChange={(e) => setIncludeMeta(e.target.checked)} />
            <span>
              <strong>From your photos:</strong> {photoMeta.summary}
            </span>
          </label>
        )}

        <div className="field-row">
          <label className="field">
            <span>Vibe</span>
            <select value={vibe} onChange={(e) => setVibe(e.target.value)}>
              {VIBES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Art style</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)} disabled={!stylize}>
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Narrator perspective</span>
          <select value={perspective} onChange={(e) => setPerspective(e.target.value)}>
            {PERSPECTIVES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={stylize} onChange={(e) => setStylize(e.target.checked)} />
          <span>Stylize my photos</span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={bedtime} onChange={(e) => setBedtime(e.target.checked)} />
          <span>
            🌙 Bedtime story
            <small className="toggle-sub">Retell it gently, for reading to a child</small>
          </span>
        </label>
      </section>

      <button className="cta" disabled={!canSubmit} onClick={submit}>
        {busy ? 'Working…' : photos.length ? `Make my photo book (${photos.length})` : 'Add photos to begin'}
      </button>

      {picker && (
        <LibraryPicker onClose={() => setPicker(false)} onAdd={addFromLibrary} />
      )}
    </div>
  )
}

// Multi-select picker over the existing photo library (portaled above the page).
function LibraryPicker({ onAdd, onClose }) {
  const [photos, setPhotos] = useState([])
  const [sel, setSel] = useState(() => new Set())
  useEffect(() => {
    listPhotos()
      .then(setPhotos)
      .catch(() => setPhotos([]))
  }, [])
  function toggle(id) {
    setSel((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const chosen = photos.filter((p) => sel.has(p.id))
  return createPortal(
    <div className="tb-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker">
        <div className="picker-head">
          <strong>{sel.size ? `${sel.size} selected` : 'Choose from Photos'}</strong>
          <button onClick={onClose}>Cancel</button>
        </div>
        {photos.length === 0 ? (
          <p className="picker-empty">No photos in your library yet — add some in the Photos tab first.</p>
        ) : (
          <div className="picker-scroll">
            <div className="picker-grid">
              {photos.map((p) => (
                <button key={p.id} className={sel.has(p.id) ? 'sel' : ''} onClick={() => toggle(p.id)}>
                  <img src={p.url} alt="" loading="lazy" />
                  {sel.has(p.id) && <span className="picker-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          className="picker-add"
          disabled={!sel.size}
          onClick={() => {
            onAdd(chosen.map((p) => ({ url: p.url, meta: p.meta })))
            onClose()
          }}
        >
          {sel.size ? `Add ${sel.size}` : 'Select photos to add'}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
