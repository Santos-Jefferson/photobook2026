import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import Loader from './components/Loader'
import ErrorBoundary from './components/ErrorBoundary'
import { generatePhotoBook, buildPayload, buildDemoResponse } from './api'
import { normalizeBook } from './book'

export default function App() {
  const [view, setView] = useState('create') // create | loading | story | error
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')

  async function handleGenerate({ payload, previewDataUrls, demo }) {
    setView('loading')
    setError('')
    try {
      const raw = demo
        ? await fakeDelay(buildDemoResponse(payload, previewDataUrls), 1400)
        : await generatePhotoBook(payload)

      // Log the raw response so we can see exactly what the server returned.
      console.log('[Photobook] raw API response:', raw)

      const result = normalizeBook(raw)
      console.log('[Photobook] normalized book:', result)

      const hasContent = result && (result.opening || (Array.isArray(result.pages) && result.pages.length))
      if (!hasContent) {
        setError(
          'The API responded, but the story content was empty or in an unexpected shape. ' +
            'Open the browser console to see the raw response.\n\n' +
            JSON.stringify(raw, null, 2).slice(0, 2000),
        )
        setView('error')
        return
      }

      setBook(result)
      setView('story')
    } catch (err) {
      console.error('[Photobook] generate failed:', err)
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
    return (
      <ErrorBoundary onReset={reset}>
        <StoryViewer book={book} onExit={reset} />
      </ErrorBoundary>
    )
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
