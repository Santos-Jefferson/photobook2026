import { useEffect, useRef, useState } from 'react'
import { VIBES, STYLES, MAX_PHOTOS, DEFAULT_API_URL } from '../config'
import { fileToBase64, getApiUrl, setApiUrl, getApiKey, setApiKey } from '../api'

let uid = 0

export default function Creator({ onGenerate, error, buildPayload }) {
  const [photos, setPhotos] = useState([]) // { id, file, url }
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [vibe, setVibe] = useState(VIBES[0])
  const [style, setStyle] = useState(STYLES[0])
  const [stylize, setStylize] = useState(true)
  const [strength, setStrength] = useState(0.7)
  const [busy, setBusy] = useState(false)

  const [apiUrl, setUrl] = useState(getApiUrl())
  const [apiKey, setKey] = useState(getApiKey())
  const [demo, setDemo] = useState(!getApiUrl())
  const [showSettings, setShowSettings] = useState(false)

  const fileInput = useRef(null)
  const dragIndex = useRef(null)

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line

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
      const photosBase64 = await Promise.all(photos.map((p) => fileToBase64(p.file)))
      const previewDataUrls = await Promise.all(photos.map((p) => fileToDataUrl(p.file)))
      const payload = buildPayload({
        photosBase64,
        vibe,
        stylizeImages: stylize,
        styleStrength: Number(strength),
        style,
        title: title.trim(),
        context: context.trim(),
      })
      await onGenerate({ payload, previewDataUrls, demo })
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
      </section>

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
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Context</span>
          <textarea
            rows={3}
            value={context}
            placeholder="During Memorial Day we went to the Bonneville Salt Flats as a family."
            onChange={(e) => setContext(e.target.value)}
          />
        </label>

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

        <label className="toggle">
          <input type="checkbox" checked={stylize} onChange={(e) => setStylize(e.target.checked)} />
          <span>Stylize my photos</span>
        </label>

        {stylize && (
          <label className="field">
            <span>
              Style strength <strong>{Number(strength).toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={strength}
              onChange={(e) => setStrength(e.target.value)}
            />
          </label>
        )}
      </section>

      {/* API settings */}
      <section className="card">
        <button type="button" className="settings-toggle" onClick={() => setShowSettings((s) => !s)}>
          <span>API &amp; demo settings</span>
          <span className="muted">{demo ? 'Demo mode' : 'Live API'} {showSettings ? '▲' : '▼'}</span>
        </button>
        {showSettings && (
          <div className="settings-body">
            <label className="toggle">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
              <span>Demo mode (no server — narrate locally using your photos)</span>
            </label>
            <label className="field">
              <span>Photo book API URL</span>
              <input
                type="url"
                value={apiUrl}
                disabled={demo}
                placeholder={DEFAULT_API_URL || 'https://your-server.example.com/api/photobook'}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <label className="field">
              <span>API key (Bearer token)</span>
              <input
                type="password"
                value={apiKey}
                disabled={demo}
                placeholder="dev-secret"
                autoComplete="off"
                onChange={(e) => setKey(e.target.value)}
              />
            </label>
            <p className="muted small">
              The app POSTs the documented JSON payload to this URL and renders the response. The URL is saved in
              your browser only.
            </p>
          </div>
        )}
      </section>

      <button className="cta" disabled={!canSubmit} onClick={submit}>
        {busy ? 'Working…' : photos.length ? `Make my photo book (${photos.length})` : 'Add photos to begin'}
      </button>
    </div>
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
