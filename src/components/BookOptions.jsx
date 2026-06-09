import { useState } from 'react'
import { VIBES, STYLES, PERSPECTIVES, MIN_PHOTOS, MAX_PHOTOS } from '../config'

// The "set the mood" step shown after photos are chosen (from a Photos selection
// or a Memory) and before generating — the same controls the dedicated creator
// page had: title, context, vibe, art style, narrator perspective, stylize.
export default function BookOptions({ photos: initialPhotos, title: initialTitle, onGenerate, onBack }) {
  const [photos, setPhotos] = useState(initialPhotos || [])
  const [title, setTitle] = useState(initialTitle || '')
  const [context, setContext] = useState('')
  const [vibe, setVibe] = useState(VIBES[0])
  const [perspective, setPerspective] = useState(PERSPECTIVES[0].code)
  const [style, setStyle] = useState(STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0])
  const [stylize, setStylize] = useState(true)
  const [bedtime, setBedtime] = useState(false)
  const [busy, setBusy] = useState(false)

  const canSubmit = photos.length >= MIN_PHOTOS && photos.length <= MAX_PHOTOS && !busy

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
      await onGenerate({ photos, title: title.trim(), context: context.trim(), vibe, style, perspective, stylize, bedtime })
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
          <span className="muted">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        <div className="thumbs">
          {photos.map((src, i) => (
            <figure key={i} className="thumb">
              <img src={src} alt={`Photo ${i + 1}`} />
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
        {busy ? 'Working…' : `Make my photobook (${photos.length})`}
      </button>
    </div>
  )
}
