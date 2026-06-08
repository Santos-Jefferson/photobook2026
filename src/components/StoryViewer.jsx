import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSlides } from '../book'
import { downloadStoryHtml } from '../share'
import { downloadStoryPdf, shareToWhatsApp, shareToInstagram } from '../export'
import { useNarration, NARRATION_LANGS, VOICE_OPTIONS } from '../narration'
import { translateBook } from '../translateClient'
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

  // Display/narration language. '' = show the story as authored. When set, the
  // visible text is translated to it and the audio narrates that same text.
  const [textLang, setTextLang] = useState('')
  const [translations, setTranslations] = useState({}) // lang -> translated book
  const [sharing, setSharing] = useState(false) // an export/share is in progress
  const [shareMenu, setShareMenu] = useState(false) // export options popover open

  // A new generated book resets the viewer.
  useEffect(() => {
    setLiveBook(book)
    setIndex(0)
  }, [book])

  // Edits invalidate any cached translations.
  useEffect(() => {
    setTranslations({})
  }, [liveBook])

  // Translate the visible text whenever a language is chosen.
  useEffect(() => {
    let cancelled = false
    if (!textLang || translations[textLang]) return
    translateBook(liveBook, textLang)
      .then((tb) => !cancelled && setTranslations((prev) => ({ ...prev, [textLang]: tb })))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [textLang, liveBook, translations])

  const translated = textLang ? translations[textLang] : null
  const displayBook = translated || liveBook
  const slides = useMemo(() => buildSlides(displayBook), [displayBook])

  const total = slides.length
  const slide = slides[index]
  const pageIndex = slide && slide.type === 'photo' ? index - 1 : -1

  // All story photos, used as a collage on the opening/closing covers.
  const collageImages = useMemo(
    () => slides.filter((s) => s.type === 'photo' && s.image).map((s) => s.image),
    [slides],
  )

  // If the visible text is already translated, the audio shouldn't translate
  // again; otherwise let the server translate to the chosen voice language.
  const narration = useNarration({ slides, index, setIndex, translateAudio: !translated })

  function changeLang(v) {
    narration.setLang(v)
    setTextLang(v)
  }

  // Run an export/share action with a shared busy state; closes the menu.
  async function runExport(fn) {
    if (sharing) return
    setShareMenu(false)
    setSharing(true)
    try {
      await fn()
    } catch (e) {
      console.error('[Photobook] export failed:', e)
    } finally {
      setSharing(false)
    }
  }

  const exportOptions = [
    { key: 'pdf', label: 'Download PDF', icon: '📄', run: () => downloadStoryPdf(displayBook) },
    {
      key: 'html',
      // Self-contained .html (collage + offline narration in the current voice).
      label: 'Export Photobook',
      icon: '📖',
      run: () => downloadStoryHtml(displayBook, textLang || 'en', narration.voice),
    },
    { key: 'whatsapp', label: 'Share to WhatsApp', icon: '🟢', run: () => shareToWhatsApp(displayBook) },
    { key: 'instagram', label: 'Share to Instagram', icon: '📸', run: () => shareToInstagram(displayBook) },
  ]

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

  // `book` is the immutable original; compare against it to know if the current
  // page's photo was edited, and to restore it.
  const originalPage = pageIndex >= 0 && Array.isArray(book.pages) ? book.pages[pageIndex] : null
  const livePage = pageIndex >= 0 && Array.isArray(liveBook.pages) ? liveBook.pages[pageIndex] : null
  const canRevert = !!originalPage && !!livePage && originalPage.styled_image_b64 !== livePage.styled_image_b64

  function revertPhoto() {
    if (!originalPage) return
    updatePage(pageIndex, {
      styled_image_b64: originalPage.styled_image_b64,
      style_applied: originalPage.style_applied,
    })
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
        aria-label="Share & export"
        aria-haspopup="true"
        onClick={() => setShareMenu(true)}
        disabled={sharing}
      >
        {sharing ? '… Preparing' : '⤓ Share'}
      </button>
      <button className="viewer-debug" aria-label="Debug" onClick={() => setShowDebug((s) => !s)}>
        {'{}'}
      </button>

      {/* Share & export options */}
      {shareMenu && (
        <div className="share-sheet-backdrop" onClick={() => setShareMenu(false)}>
          <div className="share-sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            <div className="share-sheet-title">Share &amp; export</div>
            {exportOptions.map((o) => (
              <button key={o.key} className="share-opt" role="menuitem" onClick={() => runExport(o.run)}>
                <span className="share-opt-ico" aria-hidden="true">
                  {o.icon}
                </span>
                {o.label}
              </button>
            ))}
            <button className="share-sheet-close" onClick={() => setShareMenu(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* narration controls */}
      {narration.supported && (
        <div className="narrate-bar">
          <button
            className={`narrate-btn ${narration.narrating ? 'on' : ''}`}
            onClick={narration.toggle}
            aria-label={narration.narrating ? 'Pause narration' : 'Play narration'}
          >
            <span className="narrate-ico">{narration.loading ? '…' : narration.narrating ? '⏸' : '▶'}</span>
            {narration.narrating ? 'Narrating' : 'Narrate'}
          </button>
          <select
            className="narrate-lang"
            value={narration.lang}
            onChange={(e) => changeLang(e.target.value)}
            aria-label="Story & narration language"
          >
            {NARRATION_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
                {narration.fallback && !narration.hasVoiceForLang(l.code) ? ' (no voice)' : ''}
              </option>
            ))}
          </select>
          <select
            className="narrate-lang narrate-voice"
            value={narration.voice}
            onChange={(e) => narration.setVoice(e.target.value)}
            aria-label="Narration voice"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.code} value={v.code}>
                {v.label}
              </option>
            ))}
          </select>
          {textLang && !translations[textLang] && <span className="narrate-note">Translating…</span>}
          {narration.note && <span className="narrate-note">{narration.note}</span>}
        </div>
      )}

      {showDebug && (
        <div className="debug" onClick={() => setShowDebug(false)}>
          <pre onClick={(e) => e.stopPropagation()}>{JSON.stringify(liveBook, null, 2)}</pre>
        </div>
      )}

      <Slide slide={slide} revealed={revealed} collageImages={collageImages} />

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
            caption={slide.caption}
            narrative={slide.narrative}
            storyContext={displayBook?.opening || displayBook?.context || ''}
            canRevert={canRevert}
            onRevert={revertPhoto}
            onApplyImage={applyImage}
            onApplyText={applyText}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}

      {slide.type === 'closing' && (
        <div className="closing-actions">
          <button className="restart restart-share" onClick={() => setShareMenu(true)} disabled={sharing}>
            {sharing ? '… Preparing' : '⤓ Share & export'}
          </button>
          <button className="restart restart-ghost" onClick={onExit}>
            Make another
          </button>
        </div>
      )}
    </div>
  )
}

function Slide({ slide, revealed, collageImages }) {
  const hasCollage = Array.isArray(collageImages) && collageImages.length > 0

  if (slide.type === 'opening') {
    return (
      <div className={`slide slide-text slide-opening ${hasCollage ? 'has-collage' : ''} ${revealed ? 'in' : ''}`}>
        <div className="slide-text-inner">
          {slide.vibe && <span className="kicker">{slide.vibe}</span>}
          <h1 className="cover-title">{slide.title}</h1>
          <p className="cover-body">{slide.text}</p>
          <span className="swipe-hint">swipe to begin →</span>
        </div>
        <CoverCollage images={collageImages} />
      </div>
    )
  }

  if (slide.type === 'closing') {
    return (
      <div className={`slide slide-text slide-closing ${hasCollage ? 'has-collage' : ''} ${revealed ? 'in' : ''}`}>
        <div className="slide-text-inner">
          <span className="kicker">the end</span>
          <p className="cover-body large">{slide.text}</p>
          <h2 className="closing-title">{slide.title}</h2>
        </div>
        <CoverCollage images={collageImages} />
      </div>
    )
  }

  // photo slide
  return <PhotoSlide slide={slide} revealed={revealed} />
}

// A grid of all the story's photos, shown as a band at the bottom of the
// opening/closing covers so they aren't text-only.
function CoverCollage({ images }) {
  if (!Array.isArray(images) || images.length === 0) return null
  const shown = images.slice(0, 9)
  return (
    <div className={`cover-collage cells-${shown.length}`}>
      {shown.map((src, i) => (
        <span className="cover-collage-cell" key={i}>
          <img src={src} alt="" aria-hidden="true" />
        </span>
      ))}
      <div className="cover-collage-fade" />
    </div>
  )
}

function PhotoSlide({ slide, revealed }) {
  const [imgError, setImgError] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  // Offer the toggle only when we actually have a distinct original + styled.
  const canToggle = !!slide.styled && !!slide.original && slide.styled !== slide.original
  // Reset to the styled view whenever we move to a different photo.
  useEffect(() => setShowOriginal(false), [slide.page])

  const src = showOriginal && slide.original ? slide.original : slide.image
  const hasImage = src && !imgError

  return (
    <div className={`slide slide-photo ${revealed ? 'in' : ''}`}>
      {hasImage ? (
        <>
          {/* Blurred fill of the same photo so a landscape shot in a portrait
              frame (or vice-versa) gets a soft backdrop instead of black bars,
              while the foreground shows the whole photo at its true aspect
              ratio — nothing cropped, orientation preserved. */}
          <img className="slide-img-bg" src={src} alt="" aria-hidden="true" />
          <img
            className="slide-img"
            src={src}
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
      {canToggle && (
        <div className="orig-toggle" role="group" aria-label="Compare original and styled photo">
          <button
            type="button"
            className={!showOriginal ? 'on' : ''}
            onClick={(e) => {
              e.stopPropagation()
              setShowOriginal(false)
            }}
          >
            Styled
          </button>
          <button
            type="button"
            className={showOriginal ? 'on' : ''}
            onClick={(e) => {
              e.stopPropagation()
              setShowOriginal(true)
            }}
          >
            Original
          </button>
        </div>
      )}
      <div className="slide-caption">
        {slide.caption && <p className="caption">{slide.caption}</p>}
        {slide.narrative && <p className="narrative">{slide.narrative}</p>}
        {slide.styleApplied && <span className="style-chip">{slide.styleApplied.replace(/_/g, ' ')}</span>}
      </div>
    </div>
  )
}
