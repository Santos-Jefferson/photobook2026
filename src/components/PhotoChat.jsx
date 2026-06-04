import { useEffect, useRef, useState } from 'react'
import { analyzePhoto, sendPhotoMessage } from '../photoChat'
import { STYLES } from '../config'

// Editing panel for a single story photo. Sends natural-language messages to
// the photo-chat API and routes the result: a new image replaces the page's
// photo; a text response can be applied as the caption or narrative.
export default function PhotoChat({ photo, canRevert, onRevert, onApplyImage, onApplyText, onClose }) {
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(true)
  const [thread, setThread] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [style, setStyle] = useState(STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0])

  // Always send the latest photo (chains edits) even though we analyze once.
  const photoRef = useRef(photo)
  useEffect(() => {
    photoRef.current = photo
  }, [photo])

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
        if (r.result_image_b64) onApplyImage(r.result_image_b64, r.style_applied)
        const label = r.style_applied ? ` (${String(r.style_applied).replace(/_/g, ' ')})` : ''
        setThread((t) => [...t, { role: 'assistant', text: `✓ ${r.action_type} applied${label}.` }])
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

        {!thread.length && suggestions.length > 0 && (
          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="chip" disabled={busy} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {thread.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.error ? 'err' : ''}`}>
            <p>{m.text}</p>
            {m.applyable && (
              <div className="bubble-actions">
                <button onClick={() => onApplyText('caption', m.text)}>Use as caption</button>
                <button onClick={() => onApplyText('narrative', m.text)}>Use as narrative</button>
              </div>
            )}
          </div>
        ))}

        {busy && <p className="chat-muted">Working…</p>}
      </div>

      {err && !thread.length && <div className="chat-err">{err}</div>}

      <div className="chat-input">
        <select
          className="chat-style"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          title="Fallback style when you ask for a style without naming one"
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
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
