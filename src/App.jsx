import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import Loader from './components/Loader'
import { generatePhotoBook, buildPayload, buildDemoResponse } from './api'

export default function App() {
  const [view, setView] = useState('create') // create | loading | story | error
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')

  async function handleGenerate({ payload, previewDataUrls, demo }) {
    setView('loading')
    setError('')
    try {
      const result = demo
        ? await fakeDelay(buildDemoResponse(payload, previewDataUrls), 1400)
        : await generatePhotoBook(payload)
      setBook(result)
      setView('story')
    } catch (err) {
      setError(err.message || String(err))
      setView('error')
    }
  }

  function reset() {
    setBook(null)
    setError('')
    setView('create')
  }

  if (view === 'loading') return <Loader />

  if (view === 'story' && book) {
    return <StoryViewer book={book} onExit={reset} />
  }

  return (
    <Creator
      onGenerate={handleGenerate}
      error={view === 'error' ? error : ''}
      buildPayload={buildPayload}
    />
  )
}

function fakeDelay(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
