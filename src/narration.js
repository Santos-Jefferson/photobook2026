// Voice narration for the story. Primary engine is a natural human voice from
// the /api/narrate serverless function (ElevenLabs + translation). If that
// endpoint isn't available (e.g. no backend, or running the static export), it
// falls back to the browser's built-in Web Speech voice.

import { useCallback, useEffect, useRef, useState } from 'react'

export const NARRATION_LANGS = [
  { code: 'en', label: 'English', bcp: 'en-US' },
  { code: 'pt', label: 'Português', bcp: 'pt-BR' },
  { code: 'es', label: 'Español', bcp: 'es-ES' },
]

const NARRATE_ENDPOINT = '/api/narrate'

const bcpFor = (code) => (NARRATION_LANGS.find((l) => l.code === code) || {}).bcp || 'en-US'

// What gets read aloud for a given slide.
export function narrationTextForSlide(slide) {
  if (!slide) return ''
  if (slide.type === 'opening') return [slide.title, slide.text].filter(Boolean).join('. ')
  if (slide.type === 'closing') return [slide.text, slide.title].filter(Boolean).join('. ')
  return [slide.caption, slide.narrative].filter(Boolean).join('. ')
}

export function useNarration({ slides, index, setIndex }) {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
  const canAudio = typeof window !== 'undefined' && typeof window.Audio !== 'undefined'
  const supported = canAudio || !!synth

  const [narrating, setNarrating] = useState(false)
  const [lang, setLang] = useState('en')
  const [loading, setLoading] = useState(false)
  const [fallback, setFallback] = useState(false) // true once we switch to browser voice
  const [voices, setVoices] = useState([])

  const audioRef = useRef(null)
  const cacheRef = useRef(new Map()) // key -> object URL
  const narratingRef = useRef(false)
  const tokenRef = useRef(0)

  useEffect(() => {
    narratingRef.current = narrating
  }, [narrating])

  // One reusable <audio> element.
  useEffect(() => {
    if (!canAudio) return
    const a = new window.Audio()
    a.preload = 'auto'
    audioRef.current = a
    return () => {
      a.pause()
      a.src = ''
    }
  }, [canAudio])

  // Browser voices (used only for fallback) populate asynchronously.
  useEffect(() => {
    if (!synth) return
    const load = () => setVoices(synth.getVoices() || [])
    load()
    synth.addEventListener && synth.addEventListener('voiceschanged', load)
    return () => synth.removeEventListener && synth.removeEventListener('voiceschanged', load)
  }, [synth])

  // Edits change the slides -> drop cached audio so it regenerates.
  useEffect(() => {
    const cache = cacheRef.current
    cache.forEach((url) => URL.revokeObjectURL(url))
    cache.clear()
  }, [slides])

  const pickVoice = useCallback(
    (code) => {
      const list = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(code))
      return list.find((v) => v.localService) || list[0] || null
    },
    [voices],
  )

  const hasVoiceForLang = useCallback(
    (code) => voices.some((v) => (v.lang || '').toLowerCase().startsWith(code)),
    [voices],
  )

  async function fetchAudioUrl(text, code) {
    const key = code + '::' + index + '::' + text
    const cache = cacheRef.current
    if (cache.has(key)) return cache.get(key)
    const res = await fetch(NARRATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: code }),
    })
    if (!res.ok) throw new Error('narrate ' + res.status)
    const blob = await res.blob()
    if (!blob.type || !blob.type.startsWith('audio')) throw new Error('not audio')
    const url = URL.createObjectURL(blob)
    cache.set(key, url)
    return url
  }

  // Speak the current slide while narrating; advance on end. Driven by `index`
  // so manual nav and auto-advance share one path.
  useEffect(() => {
    if (!narrating) return
    const last = slides.length - 1
    const text = narrationTextForSlide(slides[index])
    const myToken = ++tokenRef.current

    const advance = () => {
      if (!narratingRef.current || tokenRef.current !== myToken) return
      if (index < last) setIndex((i) => Math.min(i + 1, last))
      else setNarrating(false)
    }

    if (!text) {
      const t = setTimeout(advance, 300)
      return () => clearTimeout(t)
    }

    const speakBrowser = () => {
      if (!synth) {
        advance()
        return
      }
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice(lang)
      u.lang = (v && v.lang) || bcpFor(lang)
      if (v) u.voice = v
      u.rate = 0.95
      u.onend = () => {
        if (tokenRef.current === myToken) advance()
      }
      synth.cancel()
      synth.speak(u)
    }

    if (fallback || !canAudio) {
      speakBrowser()
    } else {
      setLoading(true)
      fetchAudioUrl(text, lang)
        .then((url) => {
          if (tokenRef.current !== myToken || !narratingRef.current) return
          const a = audioRef.current
          a.onended = advance
          a.src = url
          return a.play()
        })
        .catch(() => {
          // Backend missing or blocked: switch to the browser voice for good.
          if (tokenRef.current !== myToken) return
          setFallback(true)
          speakBrowser()
        })
        .finally(() => {
          if (tokenRef.current === myToken) setLoading(false)
        })
    }

    return () => {
      const a = audioRef.current
      if (a) {
        a.onended = null
        a.pause()
      }
      if (synth) synth.cancel()
    }
  }, [narrating, index, lang, fallback, canAudio, slides, setIndex, pickVoice, synth])

  // Clean up on unmount.
  useEffect(
    () => () => {
      if (synth) synth.cancel()
      const a = audioRef.current
      if (a) a.pause()
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      cacheRef.current.clear()
    },
    [synth],
  )

  const toggle = useCallback(() => setNarrating((n) => !n), [])

  return { supported, narrating, loading, fallback, toggle, lang, setLang, hasVoiceForLang }
}
