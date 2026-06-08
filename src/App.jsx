import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import Loader from './components/Loader'
import ErrorBoundary from './components/ErrorBoundary'
import { generatePhotoBook, buildPayload, buildDemoResponse } from './api'
import { normalizeBook } from './book'
import { rewriteBookPerspective } from './perspectiveClient'

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

      // Keep each uploaded photo as a fallback so a page still shows an image
      // when the API returns no styled image (e.g. stylize disabled). Pages
      // come back in the same order as the photos we sent.
      if (result && Array.isArray(result.pages) && Array.isArray(previewDataUrls)) {
        result.pages.forEach((p, i) => {
          if (p && !p.original_image && previewDataUrls[i]) p.original_image = previewDataUrls[i]
        })
      }

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

      if (result.__truncationWarnings?.length > 0) {
        console.warn('[Photobook] truncation detected:', result.__truncationWarnings)
        setError(
          'The story content appears incomplete or corrupted. The API may have had issues generating the full content.\n\n' +
            'Warnings: ' + result.__truncationWarnings.join(', '),
        )
        setView('error')
        return
      }

      // Retell the story in the chosen narrator perspective (no-op for the
      // neutral "AI Storyteller"; falls back to the original on any failure).
      const finalBook = await rewriteBookPerspective(result, payload?.perspective)

      setBook(finalBook)
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
