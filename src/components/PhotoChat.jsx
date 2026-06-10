import { useEffect, useRef, useState } from 'react'
import { analyzePhoto, sendPhotoMessage, generateGreetingCard, HOLIDAYS, CARD_TONES } from '../photoChat'
import { rewriteTexts, translateTexts } from '../memoryClient'
import { STYLES } from '../config'
import { NARRATION_LANGS } from '../narration'

// Memory-action chips: quick AI transforms of the current caption/narrative.
const MEMORY_ACTIONS = [
  { label: "Child's POV", instruction: "Rewrite from a young child's point of view — simple words, full of wonder", src: 'story' },
  { label: "Parent's POV", instruction: "Rewrite from a loving parent's point of view, warm and proud", src: 'story' },
  { label: "Friend's POV", instruction: "Rewrite from a close friend's point of view, casual and affectionate", src: 'story' },
  { label: 'Funnier', instruction: 'Make it noticeably funnier and more playful, keeping it tasteful', src: 'caption' },
  { label: 'More emotional', instruction: 'Make it more emotional, heartfelt and moving', src: 'story' },
]

// One-tap actions for a standalone photo (no story text): quick style presets
// and easy edits that show a fast visual result. Style codes must match the
// API's catalog (see config STYLES).
const QUICK_STYLES = [
  { label: '🎨 Retro Toons', code: 'Retro_Toons' },
  { label: '✨ Anime', code: 'Anime' },
  { label: '💥 Comic Book', code: 'Comic_Book' },
  { label: '🖌️ Watercolor', code: 'Watercolor_Sketch' },
  { label: '🖼️ Oil Painting', code: 'Oil_Painting' },
  { label: '✏️ Pencil Sketch', code: 'Pencil_Sketch' },
  { label: '🌈 Color Pop', code: 'Color_Pop_People_Gray_Background' },
  { label: '🔧 Enhance', code: 'Enhance_Photo' },
  { label: '🎞️ Colorize', code: 'Colorize_Photo' },
]
const QUICK_EDITS = [
  { label: '✂️ Remove background', message: 'Remove the background' },
  { label: '🌫️ Blur background', message: 'Blur the background behind the main subject' },
]

function imgSrc(v) {
  if (!v) return ''
  if (v.startsWith('data:') || v.startsWith('http')) return v
  return 'data:image/png;base64,' + v
}

// Editing panel for a single story photo. Sends natural-language messages to
// the photo-chat API and routes the result: a new image replaces the page's
// photo; a text response can be applied as the caption or narrative. Also offers
// memory actions (rewrite / translate / greeting card) over the current text.
export default function PhotoChat({
  photo,
  caption,
  narrative,
  storyContext,
  canRevert,
  onRevert,
  onApplyImage,
  onApplyText,
  onClose,
  standalone = false,
}) {
  const [analysis, setAnalysis] = useState(null)
  const [thread, setThread] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [style, setStyle] = useState(STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0])
  const [langPick, setLangPick] = useState(false) // translate language picker open
  const [cardOpen, setCardOpen] = useState(false) // greeting-card form open
  const [holiday, setHoliday] = useState(HOLIDAYS[0].key)
  const [tone, setTone] = useState('heartwarming')
  const [recipient, setRecipient] = useState('')

  // Always send the latest photo + text (edits update the props live).
  const photoRef = useRef(photo)
  const captionRef = useRef(caption)
  const narrativeRef = useRef(narrative)
  useEffect(() => {
    photoRef.current = photo
  }, [photo])
  useEffect(() => {
    captionRef.current = caption
    narrativeRef.current = narrative
  }, [caption, narrative])

  const scroller = useRef(null)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [thread])

  // Suggestions are fetched on demand (via the "Suggest edits" button) rather
  // than automatically, so the chat doesn't fire a slow request on open and
  // surface suggestions out of the blue.
  const [analyzing, setAnalyzing] = useState(false)
  async function requestSuggestions() {
    if (analyzing || busy) return
    setErr('')
    setAnalyzing(true)
    try {
      const a = await analyzePhoto(photoRef.current)
      setAnalysis(a || {})
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const imageType = (analysis && analysis.image_type) || 'photo'

  async function send(message) {
    const text = (message || '').trim()
    if (!text || busy) return
    setInput('')
    setErr('')
    setBusy(true)
    setThread((t) => [...t, { role: 'user', text }])
    try {
      const r = await sendPhotoMessage({
        photo: photoRef.current,
        message: text,
        selectedStyle: style,
        imageType,
      })
      if (r.action_type === 'style' || r.action_type === 'edit') {
        // The styled photo is the feedback — don't echo a "style applied" prompt.
        if (r.result_image_b64) onApplyImage(r.result_image_b64, r.style_applied)
      } else {
        setThread((t) => [...t, { role: 'assistant', text: r.text_response || '(no response)', applyable: true }])
      }
    } catch (e) {
      setErr(e.message || String(e))
      setThread((t) => [...t, { role: 'assistant', text: '⚠ ' + (e.message || String(e)), error: true }])
    } finally {
      setBusy(false)
    }
  }

  // Apply a specific style preset in one tap (used by the quick-action chips).
  async function applyPresetStyle(styleCode) {
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      const r = await sendPhotoMessage({
        photo: photoRef.current,
        message: `Apply the ${styleCode.replace(/_/g, ' ')} style`,
        selectedStyle: styleCode,
        imageType,
      })
      if (r.result_image_b64) onApplyImage(r.result_image_b64, r.style_applied || styleCode)
      else if (r.text_response) setErr(r.text_response)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Apply just the selected style preset — no message required, and nothing is
  // added to the chat thread (the restyled photo is the feedback).
  async function applyStyle() {
    if (busy) return
    setErr('')
    setBusy(true)
    try {
      const r = await sendPhotoMessage({
        photo: photoRef.current,
        message: `Apply the ${style.replace(/_/g, ' ')} style`,
        selectedStyle: style,
        imageType,
      })
      if (r.result_image_b64) onApplyImage(r.result_image_b64, r.style_applied || style)
      else if (r.text_response) setErr(r.text_response)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const curCaption = () => captionRef.current || ''
  const curNarrative = () => narrativeRef.current || ''
  const storyText = () => curNarrative() || curCaption()

  // Run a text action that pushes the label as a user turn and an applyable
  // assistant result. `run` returns the resulting string.
  async function runTextAction(label, run) {
    if (busy) return
    setErr('')
    setLangPick(false)
    setBusy(true)
    setThread((t) => [...t, { role: 'user', text: label }])
    try {
      const result = await run()
      setThread((t) => [...t, { role: 'assistant', text: result, applyable: true }])
    } catch (e) {
      setErr(e.message || String(e))
      setThread((t) => [...t, { role: 'assistant', text: '⚠ ' + (e.message || String(e)), error: true }])
    } finally {
      setBusy(false)
    }
  }

  function runRewrite(a) {
    const text = a.src === 'caption' ? curCaption() : storyText()
    if (!text) {
      setErr('Add a caption or narrative to this photo first.')
      return
    }
    runTextAction(a.label, async () => {
      const [out] = await rewriteTexts([text], a.instruction)
      return out || text
    })
  }

  function runTranslate(lang) {
    const text = storyText()
    if (!text) {
      setErr('Add a caption or narrative to this photo first.')
      return
    }
    const label = (NARRATION_LANGS.find((l) => l.code === lang) || {}).label || lang
    runTextAction('Translate → ' + label, async () => {
      const [out] = await translateTexts([text], lang)
      return out || text
    })
  }

  async function runGreetingCard() {
    if (busy) return
    setErr('')
    setCardOpen(false)
    setBusy(true)
    const holidayLabel = (HOLIDAYS.find((h) => h.key === holiday) || {}).label || holiday
    setThread((t) => [...t, { role: 'user', text: `Greeting card · ${holidayLabel} · ${tone}` }])
    try {
      const who = recipient.trim()
      // Reinforce the recipient in the context too — the model sometimes drops it.
      const context = [who ? `For ${who}.` : '', storyContext, curCaption(), curNarrative()]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 500)
      const r = await generateGreetingCard({ holiday, tone, photo: photoRef.current, recipient: who, context })
      let headline = r.headline || ''
      let message = r.message || ''
      const closing = r.closing || ''
      // Fallback: make sure the recipient's name actually appears on the card.
      if (who) {
        const hay = `${headline}\n${message}\n${closing}`.toLowerCase()
        if (!hay.includes(who.toLowerCase())) {
          if (headline && !/^(dear|to)\b/i.test(headline)) headline = `To ${who}`
          else message = `Dear ${who},\n${message}`.trim()
        }
      }
      setThread((t) => [
        ...t,
        { role: 'assistant', card: { headline, message, closing, image: r.styled_image_b64 || '' } },
      ])
    } catch (e) {
      setErr(e.message || String(e))
      setThread((t) => [...t, { role: 'assistant', text: '⚠ ' + (e.message || String(e)), error: true }])
    } finally {
      setBusy(false)
    }
  }

  const suggestions = (analysis && analysis.suggestions) || []

  return (
    <div className="chat" onClick={(e) => e.stopPropagation()}>
      <div className="chat-head">
        <div>
          <strong>Edit this photo</strong>
        </div>
        <div className="chat-head-actions">
          {canRevert && (
            <button
              className="chat-revert"
              onClick={() => {
                onRevert()
                setThread((t) => [...t, { role: 'assistant', text: '↩ Photo reverted to the original.' }])
              }}
            >
              ↩ Revert
            </button>
          )}
          <button className="chat-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="chat-body" ref={scroller}>
        {/* Standalone photo (no story text): one-tap style presets + quick edits.
            In a story, instead show the memory-text actions. */}
        {standalone ? (
          <div className="chat-actions">
            {QUICK_STYLES.map((s) => (
              <button key={s.code} className="chip chip-action" disabled={busy} onClick={() => applyPresetStyle(s.code)}>
                {s.label}
              </button>
            ))}
            {QUICK_EDITS.map((e) => (
              <button key={e.label} className="chip chip-action" disabled={busy} onClick={() => send(e.message)}>
                {e.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="chat-actions">
            {MEMORY_ACTIONS.map((a) => (
              <button key={a.label} className="chip chip-action" disabled={busy} onClick={() => runRewrite(a)}>
                {a.label}
              </button>
            ))}
            <button
              className={`chip chip-action ${langPick ? 'on' : ''}`}
              disabled={busy}
              onClick={() => {
                setCardOpen(false)
                setLangPick((o) => !o)
              }}
            >
              Translate ▾
            </button>
            <button
              className={`chip chip-action chip-card ${cardOpen ? 'on' : ''}`}
              disabled={busy}
              onClick={() => {
                setLangPick(false)
                setCardOpen((o) => !o)
              }}
            >
              ✨ Greeting card
            </button>
          </div>
        )}

        {langPick && (
          <div className="chat-langs">
            {NARRATION_LANGS.filter((l) => l.code !== 'en').map((l) => (
              <button key={l.code} className="chip" disabled={busy} onClick={() => runTranslate(l.code)}>
                {l.label}
              </button>
            ))}
          </div>
        )}

        {cardOpen && (
          <div className="card-form">
            <div className="card-form-row">
              <select value={holiday} onChange={(e) => setHoliday(e.target.value)}>
                {HOLIDAYS.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label}
                  </option>
                ))}
              </select>
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                {CARD_TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={recipient}
              placeholder="Recipient (optional) — e.g. The Johnson Family"
              maxLength={100}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <button className="card-generate" disabled={busy} onClick={runGreetingCard}>
              Generate card
            </button>
          </div>
        )}

        {/* On-demand suggestions: tap to ask the analyze API what edits suit
            this photo. Only fired when requested, never automatically. */}
        {!analysis ? (
          <button className="chat-suggest-btn" disabled={analyzing || busy} onClick={requestSuggestions}>
            {analyzing ? 'Looking at your photo…' : '💡 Suggest edits for this photo'}
          </button>
        ) : suggestions.length > 0 ? (
          <div className="chat-suggestions">
            <span className="chat-suggest-label">Suggestions</span>
            {suggestions.map((s, i) => (
              <button key={i} className="chip" disabled={busy} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="chat-muted">No suggestions for this photo — try a style or describe an edit below.</p>
        )}

        {thread.map((m, i) =>
          m.card ? (
            <div key={i} className="bubble assistant card-bubble">
              {m.card.image && (
                <img className="card-img" src={imgSrc(m.card.image)} alt="Holiday-styled photo" />
              )}
              {m.card.headline && <p className="card-headline">{m.card.headline}</p>}
              {m.card.message && <p className="card-message">{m.card.message}</p>}
              {m.card.closing && <p className="card-closing">{m.card.closing}</p>}
              <div className="bubble-actions">
                {m.card.headline && (
                  <button onClick={() => onApplyText('caption', m.card.headline)}>Headline → caption</button>
                )}
                {m.card.message && (
                  <button onClick={() => onApplyText('narrative', m.card.message)}>Message → narrative</button>
                )}
                {m.card.image && <button onClick={() => onApplyImage(m.card.image)}>Use styled photo</button>}
              </div>
            </div>
          ) : (
            <div key={i} className={`bubble ${m.role} ${m.error ? 'err' : ''}`}>
              <p>{m.text}</p>
              {m.applyable && (
                <div className="bubble-actions">
                  <button onClick={() => onApplyText('caption', m.text)}>Use as caption</button>
                  <button onClick={() => onApplyText('narrative', m.text)}>Use as narrative</button>
                </div>
              )}
            </div>
          ),
        )}

        {busy && <p className="chat-muted">Working…</p>}
      </div>

      {err && !thread.length && <div className="chat-err">{err}</div>}

      <div className="chat-input">
        <select
          className="chat-style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          title="Pick a style preset, then Apply — or name a style in your message"
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <button
          className="chat-apply-style"
          disabled={busy}
          onClick={applyStyle}
          title="Apply the selected style preset to this photo"
        >
          Apply
        </button>
        <input
          type="text"
          value={input}
          placeholder="e.g. make it watercolor, remove the background…"
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(input)
          }}
        />
        <button className="chat-send" disabled={busy || !input.trim()} onClick={() => send(input)}>
          Send
        </button>
      </div>
    </div>
  )
}
