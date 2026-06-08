import { useEffect, useRef, useState } from 'react'
import { analyzePhoto, sendPhotoMessage, generateGreetingCard, HOLIDAYS, CARD_TONES } from '../photoChat'
import { rewriteTexts, translateTexts } from '../memoryClient'
import { STYLES } from '../config'
import { NARRATION_LANGS } from '../narration'

// Memory-action chips: quick AI transforms of the current caption/narrative.
const MEMORY_ACTIONS = [
  { label: "Child's POV", instruction: "Rewrite from a young child's point of view — simple words, full of wonder", src: 'story' },
  { label: 'Funnier', instruction: 'Make it noticeably funnier and more playful, keeping it tasteful', src: 'caption' },
  { label: 'More emotional', instruction: 'Make it more emotional, heartfelt and moving', src: 'story' },
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
}) {
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(true)
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
  }, [thread, analyzing])

  // Analyze once when the panel opens to get suggestions + image_type.
  useEffect(() => {
    let cancelled = false
    setAnalyzing(true)
    setErr('')
    analyzePhoto(photoRef.current)
      .then((a) => !cancelled && setAnalysis(a))
      .catch((e) => !cancelled && setErr(e.message || String(e)))
      .finally(() => !cancelled && setAnalyzing(false))
    return () => {
      cancelled = true
    }
  }, [])

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
      const context = [storyContext, curCaption(), curNarrative()].filter(Boolean).join(' — ').slice(0, 500)
      const r = await generateGreetingCard({ holiday, tone, photo: photoRef.current, recipient, context })
      setThread((t) => [
        ...t,
        {
          role: 'assistant',
          card: {
            headline: r.headline || '',
            message: r.message || '',
            closing: r.closing || '',
            image: r.styled_image_b64 || '',
          },
        },
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
          {analysis && analysis.image_type && <span className="chat-type">{analysis.image_type}</span>}
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
        {analyzing && <p className="chat-muted">Analyzing photo…</p>}

        {analysis && analysis.description && <p className="chat-desc">{analysis.description}</p>}

        {/* memory actions — quick AI transforms of this memory */}
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

        {!thread.length && suggestions.length > 0 && (
          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="chip" disabled={busy} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
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
