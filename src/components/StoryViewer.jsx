import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSlides } from '../book'
import { downloadStoryHtml } from '../share'
import { useNarration, NARRATION_LANGS } from '../narration'
import PhotoChat from './PhotoChat'

export default function StoryViewer({ book, onExit }) {
  // Local, editable copy so photo-chat edits update the story live (and flow
  // into narration + the HTML export).
  const [liveBook, setLiveBook] = useState(book)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const touch = useRef({ x: 0, y: 0, t: 0 })

  // A new generated book resets the viewer.
  useEffect(() => {
    setLiveBook(book)
    setIndex(0)
  }, [book])

  const slides = useMemo(() => buildSlides(liveBook), [liveBook])

  const total = slides.length
  const slide = slides[index]
  const pageIndex = slide && slide.type === 'photo' ? index - 1 : -1

  const narration = useNarration({ slides, index, setIndex })

  // Close the editor when leaving a photo slide.
  useEffect(() => {
    if (!slide || slide.type !== 'photo') setChatOpen(false)
  }, [index, slide])

  function updatePage(pi, patch) {
    setLiveBook((prev) => {
      const pages = Array.isArray(prev.pages) ? prev.pages.slice() : []
      if (pi < 0 || pi >= pages.length) return prev
      pages[pi] = { ...pages[pi], ...patch }
      return { ...prev, pages }
    })
  }

  function applyImage(b64, styleApplied) {
    updatePage(pageIndex, {
      styled_image_b64: b64,
      ...(styleApplied ? { style_applied: styleApplied } : {}),
    })
  }

  function applyText(field, text) {
    if (field === 'caption') updatePage(pageIndex, { caption: text })
    else updatePage(pageIndex, { narrative_beat: text })
  }

  const go = (next) => {
    setIndex((i) => Math.min(Math.max(i + next, 0), total - 1))
  }

  // Re-trigger the text entrance animation on each slide change.
  useEffect(() => {
    setRevealed(false)
    const id = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(id)
  }, [index])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  function onTouchStart(e) {
    const t = e.changedTouches[0]
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  function onTouchEnd(e) {
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1)
    }
  }

  return (
    <div className="viewer" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* progress bar */}
      <div className="progress">
        {slides.map((_, i) => (
          <span key={i} className={`progress-seg ${i < index ? 'done' : ''} ${i === index ? 'active' : ''}`}>
            <i />
          </span>
        ))}
      </div>

      <button className="viewer-close" aria-label="Close" onClick={onExit}>
        ×
      </button>
      <button
        className="viewer-share"
        aria-label="Download as HTML to share"
        onClick={() => downloadStoryHtml(liveBook)}
      >
        ⤓ Share
      </button>
      <button className="viewer-debug" aria-label="Debug" onClick={() => setShowDebug((s) => !s)}>
        {'{}'}
      </button>

      {/* narration controls */}
      {narration.supported && (
        <div className="narrate-bar">
          <button
            className={`narrate-btn ${narration.narrating ? 'on' : ''}`}
            onClick={narration.toggle}
            aria-label={narration.narrating ? 'Pause narration' : 'Play narration'}
          >
            <span className="narrate-ico">{narration.narrating ? '⏸' : '▶'}</span>
            {narration.narrating ? 'Narrating' : 'Narrate'}
          </button>
          <select
            className="narrate-lang"
            value={narration.lang}
            onChange={(e) => narration.setLang(e.target.value)}
            aria-label="Narration language"
          >
            {NARRATION_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
                {narration.hasVoiceForLang(l.code) ? '' : ' (no voice)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {showDebug && (
        <div className="debug" onClick={() => setShowDebug(false)}>
          <pre onClick={(e) => e.stopPropagation()}>{JSON.stringify(liveBook, null, 2)}</pre>
        </div>
      )}

      <Slide slide={slide} revealed={revealed} />

      {/* tap zones */}
      <button className="tapzone tapzone-left" aria-label="Previous" onClick={() => go(-1)} />
      <button className="tapzone tapzone-right" aria-label="Next" onClick={() => go(1)} />

      {/* explicit affordances */}
      {index > 0 && (
        <button className="nav nav-prev" onClick={() => go(-1)} aria-label="Previous">
          ‹
        </button>
      )}
      {index < total - 1 && (
        <button className="nav nav-next" onClick={() => go(1)} aria-label="Next">
          ›
        </button>
      )}

      {slide.type === 'photo' && !chatOpen && (
        <button className="edit-fab" onClick={() => setChatOpen(true)} aria-label="Edit this photo">
          ✦ Edit
        </button>
      )}

      {slide.type === 'photo' && chatOpen && pageIndex >= 0 && (
        <div className="chat-overlay" onClick={() => setChatOpen(false)}>
          <PhotoChat
            key={pageIndex}
            photo={slide.image}
            onApplyImage={applyImage}
            onApplyText={applyText}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      {slide.type === 'closing' && (
        <div className="closing-actions">
          <button className="restart restart-share" onClick={() => downloadStoryHtml(book)}>
            ⤓ Download to share
          </button>
          <button className="restart restart-ghost" onClick={onExit}>
            Make another
          </button>
        </div>
      )}
    </div>
  )
}

function Slide({ slide, revealed }) {
  if (slide.type === 'opening') {
    return (
      <div className={`slide slide-text slide-opening ${revealed ? 'in' : ''}`}>
        <div className="slide-text-inner">
          {slide.vibe && <span className="kicker">{slide.vibe}</span>}
          <h1 className="cover-title">{slide.title}</h1>
          <p className="cover-body">{slide.text}</p>
          <span className="swipe-hint">swipe to begin →</span>
        </div>
      </div>
    )
  }

  if (slide.type === 'closing') {
    return (
      <div className={`slide slide-text slide-closing ${revealed ? 'in' : ''}`}>
        <div className="slide-text-inner">
          <span className="kicker">the end</span>
          <p className="cover-body large">{slide.text}</p>
          <h2 className="closing-title">{slide.title}</h2>
        </div>
      </div>
    )
  }

  // photo slide
  return <PhotoSlide slide={slide} revealed={revealed} />
}

function PhotoSlide({ slide, revealed }) {
  const [imgError, setImgError] = useState(false)
  const hasImage = slide.image && !imgError

  return (
    <div className={`slide slide-photo ${revealed ? 'in' : ''}`}>
      {hasImage ? (
        <>
          {/* Blurred fill of the same photo so a landscape shot in a portrait
              frame (or vice-versa) gets a soft backdrop instead of black bars,
              while the foreground shows the whole photo at its true aspect
              ratio — nothing cropped, orientation preserved. */}
          <img className="slide-img-bg" src={slide.image} alt="" aria-hidden="true" />
          <img
            className="slide-img"
            src={slide.image}
            alt={slide.caption || `Page ${slide.page}`}
            onError={() => setImgError(true)}
          />
        </>
      ) : (
        <div className="slide-img slide-img-missing">
          {slide.image ? <span className="img-warn">Image failed to load</span> : null}
        </div>
      )}
      <div className="scrim" />
      <div className="slide-caption">
        {slide.caption && <p className="caption">{slide.caption}</p>}
        {slide.narrative && <p className="narrative">{slide.narrative}</p>}
        {slide.styleApplied && <span className="style-chip">{slide.styleApplied.replace(/_/g, ' ')}</span>}
      </div>
    </div>
  )
}
