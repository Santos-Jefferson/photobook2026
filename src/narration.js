// Voice narration for the story using the browser's built-in Web Speech API.
// Free, offline, multilingual (English / Portuguese / Spanish). Voice quality
// depends on the OS/browser; see README for the path to premium TTS later.

import { useCallback, useEffect, useRef, useState } from 'react'

export const NARRATION_LANGS = [
  { code: 'en', label: 'English', bcp: 'en-US' },
  { code: 'pt', label: 'Português', bcp: 'pt-BR' },
  { code: 'es', label: 'Español', bcp: 'es-ES' },
]

// What gets read aloud for a given slide.
export function narrationTextForSlide(slide) {
  if (!slide) return ''
  if (slide.type === 'opening') return [slide.title, slide.text].filter(Boolean).join('. ')
  if (slide.type === 'closing') return [slide.text, slide.title].filter(Boolean).join('. ')
  return [slide.caption, slide.narrative].filter(Boolean).join('. ')
}

export function useNarration({ slides, index, setIndex }) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  const supported = !!synth

  const [narrating, setNarrating] = useState(false)
  const [lang, setLang] = useState('en')
  const [voices, setVoices] = useState([])
  const narratingRef = useRef(false)

  useEffect(() => {
    narratingRef.current = narrating
  }, [narrating])

  // Voices populate asynchronously in most browsers.
  useEffect(() => {
    if (!synth) return
    const load = () => setVoices(synth.getVoices() || [])
    load()
    synth.addEventListener && synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener && synth.removeEventListener('voiceschanged', load)
  }, [synth])

  const pickVoice = useCallback(
    (code) => {
      const list = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(code))
      if (!list.length) return null
      // Prefer an on-device voice (usually lower latency, often higher quality).
      return list.find((v) => v.localService) || list[0]
    },
    [voices],
  )

  const hasVoiceForLang = useCallback((code) => voices.some((v) => (v.lang || '').toLowerCase().startsWith(code)), [
    voices,
  ])

  // Speak the current slide while narrating; advance to the next on end. Driven
  // by `index` so manual navigation and auto-advance share one code path.
  useEffect(() => {
    if (!synth || !narrating) return

    const text = narrationTextForSlide(slides[index])
    const last = slides.length - 1

    if (!text) {
      const t = setTimeout(() => {
        if (index < last) setIndex((i) => Math.min(i + 1, last))
        else setNarrating(false)
      }, 350)
      return () => clearTimeout(t)
    }

    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice(lang)
    const bcp = (NARRATION_LANGS.find((l) => l.code === lang) || {}).bcp || 'en-US'
    u.lang = (v && v.lang) || bcp
    if (v) u.voice = v
    u.rate = 0.95
    u.pitch = 1.0
    u.onend = () => {
      if (!narratingRef.current) return
      if (index < last) setIndex((i) => Math.min(i + 1, last))
      else setNarrating(false)
    }

    synth.cancel()
    synth.speak(u)

    return () => {
      u.onend = null
      synth.cancel()
    }
  }, [synth, narrating, index, lang, pickVoice, slides, setIndex])

  // Always stop speaking when the viewer goes away.
  useEffect(() => () => synth && synth.cancel(), [synth])

  const toggle = useCallback(() => setNarrating((n) => !n), [])

  return { supported, narrating, toggle, lang, setLang, hasVoiceForLang }
}
