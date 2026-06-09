import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import SavedBooks from './components/SavedBooks'
import Memories from './components/Memories'
import Photos from './components/Photos'
import Loader from './components/Loader'
import ErrorBoundary from './components/ErrorBoundary'
import { generatePhotoBook, buildPayload, buildDemoResponse, fileToOrientedBase64, getApiUrl } from './api'
import { normalizeBook } from './book'
import { rewriteBookPerspective } from './perspectiveClient'
import { VIBES, STYLES, PERSPECTIVES, MIN_PHOTOS, MAX_PHOTOS } from './config'
import BottomNav from './components/BottomNav'

export default function App() {
  const [view, setView] = useState('create') // create | loading | story | saved | error
  const [book, setBook] = useState(null)
  const [savedId, setSavedId] = useState('') // id of the saved record this book maps to
  const [error, setError] = useState('')

  async function handleGenerate({ payload, previewDataUrls, demo }) {
    setView('loading')
    setError('')
    setSavedId('') // a freshly generated book isn't saved yet
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
    setSavedId('')
    setError('')
    setView('create')
  }

  function openSaved(savedBook, id) {
    setBook(savedBook)
    setSavedId(id)
    setView('story')
  }

  // Generate a photobook straight from a user's memory (or a Photos selection):
  // their photos feed the normal generation flow. The cover uses the same
  // all-photos collage as a from-scratch book (no baked single-image cover).
  async function generateFromMemory(memory) {
    // A photobook needs 2–5 photos. Trim to the max; bail with a notice if too few.
    const photos = (memory.photos || []).slice(0, MAX_PHOTOS)
    if (photos.length < MIN_PHOTOS) {
      window.alert(`A photobook needs at least ${MIN_PHOTOS} photos. Add one more and try again.`)
      return
    }
    setView('loading')
    setError('')
    try {
      const previewDataUrls = photos // JPEG data URLs
      const photosBase64 = photos.map((d) => d.replace(/^data:[^,]+,/, ''))
      const payload = buildPayload({
        photosBase64,
        vibe: VIBES[0],
        stylizeImages: true,
        style: STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0],
        title: memory.title,
        context: '',
        perspective: PERSPECTIVES[0].code,
      })
      await handleGenerate({ payload, previewDataUrls, demo: !getApiUrl() })
    } catch (err) {
      setError(err.message || String(err))
      setView('error')
    }
  }

  // Photos tab → "Create photobook" on a selection of library photos. They're
  // already JPEG data URLs, so they slot straight into the memory flow.
  function createPhotobookFromPhotos(photoUrls, title) {
    if (!photoUrls || !photoUrls.length) return
    generateFromMemory({ title: title || 'My photos', photos: photoUrls })
  }

  if (view === 'loading') return <Loader />

  if (view === 'saved') {
    return (
      <>
        <SavedBooks onOpen={openSaved} onBack={() => setView('create')} />
        <BottomNav active="saved" onNavigate={setView} />
      </>
    )
  }

  if (view === 'memories') {
    return (
      <>
        <Memories onCreate={generateFromMemory} onBack={() => setView('create')} />
        <BottomNav active="memories" onNavigate={setView} />
      </>
    )
  }

  if (view === 'photos') {
    return (
      <>
        <Photos onBack={() => setView('create')} onCreatePhotobook={createPhotobookFromPhotos} />
        <BottomNav active="photos" onNavigate={setView} />
      </>
    )
  }

  if (view === 'story' && book) {
    return (
      <ErrorBoundary onReset={reset}>
        <StoryViewer book={book} onExit={reset} savedId={savedId} onSaved={setSavedId} />
      </ErrorBoundary>
    )
  }

  return (
    <>
      <Creator
        onGenerate={handleGenerate}
        error={view === 'error' ? error : ''}
        buildPayload={buildPayload}
        onOpenSaved={() => setView('saved')}
        onOpenMemories={() => setView('memories')}
        onOpenPhotos={() => setView('photos')}
      />
      <BottomNav active="create" onNavigate={setView} />
    </>
  )
}

function fakeDelay(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
