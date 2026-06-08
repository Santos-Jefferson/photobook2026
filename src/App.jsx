import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import SavedBooks from './components/SavedBooks'
import Memories from './components/Memories'
import Loader from './components/Loader'
import ErrorBoundary from './components/ErrorBoundary'
import { generatePhotoBook, buildPayload, buildDemoResponse, fileToOrientedBase64, getApiUrl } from './api'
import { normalizeBook } from './book'
import { rewriteBookPerspective } from './perspectiveClient'
import { VIBES, STYLES, PERSPECTIVES } from './config'
import { buildMemoryFiles, bakeMemoryCover, bakeCoverFromImage } from './demoMemory'
import BottomNav from './components/BottomNav'

export default function App() {
  const [view, setView] = useState('create') // create | loading | story | saved | error
  const [book, setBook] = useState(null)
  const [savedId, setSavedId] = useState('') // id of the saved record this book maps to
  const [error, setError] = useState('')

  async function handleGenerate({ payload, previewDataUrls, demo, cover }) {
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

      // Carry a Capsyl-style cover into the book (opening slide + saved thumbnail).
      if (cover) finalBook.__cover = cover

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

  // Generate a photobook straight from an example memory: build its photos, then
  // run the normal generation flow with a baked Capsyl-style cover.
  async function generateFromMemory(memory) {
    setView('loading')
    setError('')
    try {
      let photosBase64
      let previewDataUrls
      let cover
      if (memory.isUser) {
        // The user's own photos are stored as JPEG data URLs.
        previewDataUrls = memory.photos
        photosBase64 = memory.photos.map((d) => d.replace(/^data:[^,]+,/, ''))
        cover = await bakeCoverFromImage(memory.title, memory.photos[0])
      } else {
        const files = await buildMemoryFiles(memory)
        photosBase64 = await Promise.all(files.map(fileToOrientedBase64))
        previewDataUrls = photosBase64.map((b) => 'data:image/jpeg;base64,' + b)
        cover = bakeMemoryCover(memory)
      }
      const payload = buildPayload({
        photosBase64,
        vibe: memory.vibe || VIBES[0],
        stylizeImages: true,
        style: STYLES.includes('Retro_Toons') ? 'Retro_Toons' : STYLES[0],
        title: memory.title,
        context: memory.context || '',
        perspective: PERSPECTIVES[0].code,
      })
      await handleGenerate({ payload, previewDataUrls, demo: !getApiUrl(), cover })
    } catch (err) {
      setError(err.message || String(err))
      setView('error')
    }
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
      />
      <BottomNav active="create" onNavigate={setView} />
    </>
  )
}

function fakeDelay(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
