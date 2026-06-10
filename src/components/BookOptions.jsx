import { useEffect, useRef, useState } from 'react'
import { VIBES, STYLES, PERSPECTIVES, MIN_PHOTOS, MAX_PHOTOS } from '../config'
import { analyzeAlbum } from '../insightsClient'
import { summarizeStoredMetas } from '../metadata'

const urlOf = (p) => (typeof p === 'string' ? p : p.url)

// The "set the mood" step shown after photos are chosen (from a Photos selection
// or a Memory) and before generating — the same controls the dedicated creator
// page had: title, context, vibe, art style, narrator perspective, stylize, and
// the date/location context pulled from the photos' EXIF.
export default function BookOptions({ photos: initialPhotos, title: initialTitle, onGenerate, onBack }) {
  const [photos, setPhotos] = useState(initialPhotos || [])
  // EXIF-derived date/place context for the chosen photos.
  const [photoMeta, setPhotoMeta] = useState({ summary: '', place: '', hasData: false })
  const [includeMeta, setIncludeMeta] = useState(true)
  const [title, setTitle] = useState(initialTitle || '')
  const [context, setContext] = useState('')
  const [vibe, setVibe] = useState(VIBES[0])
  const [perspective, setPerspective] = useState(PERSPECTIVES[0].code)
  const [style, setStyle] = useState(STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0])
  const [stylize, setStylize] = useState(true)
  const [bedtime, setBedtime] = useState(false)
  const [busy, setBusy] = useState(false)

  // AI album analysis: auto-fills title/context (when empty) and shows insights.
  const [insights, setInsights] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  // Track whether the user has edited the fields so AI never clobbers their text.
  const titleTouched = useRef(!!initialTitle)
  const contextTouched = useRef(false)

  async function analyze() {
    setAnalyzing(true)
    try {
      const r = await analyzeAlbum((initialPhotos || []).map(urlOf))
      if (!r) return
      setInsights(r)
      if (r.title && !titleTouched.current) setTitle(r.title)
      if (r.context && !contextTouched.current) setContext(r.context)
    } finally {
      setAnalyzing(false)
    }
  }

  // Run once when the screen opens with the chosen photos.
  useEffect(() => {
    analyze()
    // EXIF (date/place) summary from the chosen photos' stored meta.
    summarizeStoredMetas((initialPhotos || []).map((p) => (typeof p === 'string' ? null : p.meta)))
      .then(setPhotoMeta)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const overBy = photos.length - MAX_PHOTOS
  const canSubmit = photos.length >= MIN_PHOTOS && photos.length <= MAX_PHOTOS && !busy
  const photosHint =
    photos.length < MIN_PHOTOS
      ? `Add at least ${MIN_PHOTOS - photos.length} more photo${MIN_PHOTOS - photos.length > 1 ? 's' : ''}.`
      : overBy > 0
        ? `A photobook uses up to ${MAX_PHOTOS} photos — remove ${overBy} to continue. Tap × on the ones to drop.`
        : ''

  function removeAt(i) {
    setPhotos((prev) => (prev.length <= MIN_PHOTOS ? prev : prev.filter((_, j) => j !== i)))
  }
  function move(from, to) {
    setPhotos((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const copy = [...prev]
      const [m] = copy.splice(from, 1)
      copy.splice(to, 0, m)
      return copy
    })
  }

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    try {
      // Fold the EXIF date/place line into the context when kept.
      const base = context.trim()
      const fullContext =
        includeMeta && photoMeta.summary ? [base, photoMeta.summary].filter(Boolean).join('\n\n') : base
      await onGenerate({ photos, title: title.trim(), context: fullContext, vibe, style, perspective, stylize, bedtime })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="creator">
      <header className="bookopts-head">
        <button className="memories-back" onClick={onBack}>
          ‹ Back
        </button>
        <h1>
          <span className="logo-dot" /> New photobook
        </h1>
        <p>Set the mood and we’ll spin these photos into a story you can swipe through.</p>
      </header>

      {/* Chosen photos (the story order) */}
      <section className="card">
        <div className="card-title">
          <h2>Your photos</h2>
          <span className={overBy > 0 ? 'muted over' : 'muted'}>
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        {photosHint && <p className={`bookopts-photos-hint ${overBy > 0 ? 'warn' : ''}`}>{photosHint}</p>}
        <div className="thumbs">
          {photos.map((p, i) => (
            <figure key={i} className="thumb">
              <img src={urlOf(p)} alt={`Photo ${i + 1}`} />
              <span className="thumb-order">{i + 1}</span>
              {photos.length > MIN_PHOTOS && (
                <button type="button" className="thumb-remove" aria-label="Remove photo" onClick={() => removeAt(i)}>
                  ×
                </button>
              )}
              <div className="thumb-move">
                <button type="button" onClick={() => move(i, i - 1)} aria-label="Move left">
                  ‹
                </button>
                <button type="button" onClick={() => move(i, i + 1)} aria-label="Move right">
                  ›
                </button>
              </div>
            </figure>
          ))}
        </div>
      </section>

      {/* AI album insights — also auto-fills title + context above. */}
      <section className="card insights-card">
        <div className="card-title">
          <h2>✨ What we noticed</h2>
          <button className="insights-regen" onClick={analyze} disabled={analyzing}>
            {analyzing ? 'Analyzing…' : insights ? 'Regenerate' : 'Analyze'}
          </button>
        </div>

        {analyzing && !insights && <p className="insights-loading">Looking through your photos…</p>}

        {!analyzing && !insights && (
          <p className="insights-empty">We couldn’t analyze these photos right now — you can still fill in the details yourself.</p>
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
            <p className="insights-foot">Title and context above were suggested from these photos — edit them anytime.</p>
          </div>
        )}
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
            <span>Mood</span>
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
        {busy
          ? 'Working…'
          : overBy > 0
            ? `Remove ${overBy} to continue`
            : `Make my photobook (${photos.length})`}
      </button>
    </div>
  )
}
