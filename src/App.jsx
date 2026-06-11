import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import SavedBooks from './components/SavedBooks'
import Memories from './components/Memories'
import NewMemory from './components/NewMemory'
import Photos from './components/Photos'
import Home from './components/Home'
import People from './components/People'
import TopBar from './components/TopBar'
import Loader from './components/Loader'
import ErrorBoundary from './components/ErrorBoundary'
import { generatePhotoBook, buildPayload, buildDemoResponse, fileToOrientedBase64, getApiUrl } from './api'
import { normalizeBook } from './book'
import { getSavedBook } from './bookStorage'
import { summarizeStoredMetas } from './metadata'
import { rewriteBookPerspective } from './perspectiveClient'
import { rewriteBookBedtime } from './bedtimeClient'
import { MIN_PHOTOS, MAX_PHOTOS } from './config'
import BottomNav from './components/BottomNav'

export default function App() {
  const [view, setView] = useState('home') // home | explore | photos | memories | saved | creator | loading | story | error
  const [book, setBook] = useState(null)
  const [savedId, setSavedId] = useState('') // id of the saved record this book maps to
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0) // bumped on uploads to refresh tabs
  const [photosFavOnly, setPhotosFavOnly] = useState(false) // open Photos pre-filtered to favorites
  const [flash, setFlash] = useState('') // transient toast message
  // (Quick create from Memory/Photos skips the options screen entirely.)

  // Show a brief toast that auto-dismisses.
  function showFlash(msg) {
    setFlash(msg)
    setTimeout(() => setFlash(''), 5000)
  }

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  // Navigate between tabs; reset the Photos favorites filter unless we're
  // explicitly opening favorites (see openFavorites).
  function navigate(v) {
    if (v === 'photos') setPhotosFavOnly(false)
    setView(v)
  }
  function openFavorites() {
    setPhotosFavOnly(true)
    setView('photos')
  }

  async function handleGenerate({ payload, previewDataUrls, demo, bedtime }) {
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
      let finalBook = await rewriteBookPerspective(result, payload?.perspective)

      // Optionally soften the whole story into a gentle bedtime read.
      if (bedtime) {
        finalBook = await rewriteBookBedtime(finalBook)
        if (finalBook.__bedtimeFailed) {
          showFlash('Bedtime mode needs the writing service, which wasn’t reachable — your story was kept as written.')
        }
      }

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
    setView('home')
  }

  function openSaved(savedBook, id) {
    setBook(savedBook)
    setSavedId(id)
    setView('story')
  }

  // Open a saved photobook by id (from the Home dashboard).
  async function openSavedById(id) {
    const b = await getSavedBook(id)
    if (b) openSaved(b, id)
  }

  // Quick create (from a Memory or a Photos selection): no options screen — uses
  // sensible defaults (Retro Toons style, heartwarming mood, AI storyteller) so
  // it's one tap. The "from scratch" creator is where the user picks options, and
  // a saved book can always be re-shaped page-by-page in chat.
  async function generateQuick(photoItems, title) {
    const items = (photoItems || []).map((p) =>
      typeof p === 'string' ? { url: p, meta: null } : { url: p.url, meta: p.meta || null },
    )
    if (items.length < MIN_PHOTOS) {
      window.alert(`A photobook needs at least ${MIN_PHOTOS} photos. Add one more and try again.`)
      return
    }
    const chosen = items.slice(0, MAX_PHOTOS)
    setView('loading')
    setError('')
    try {
      // EXIF date/place context, folded in automatically (best-effort).
      let context = ''
      try {
        const meta = await summarizeStoredMetas(chosen.map((p) => p.meta))
        context = meta.summary || ''
      } catch {
        /* no EXIF context available */
      }
      const urls = chosen.map((p) => p.url)
      const photosBase64 = urls.map((d) => d.replace(/^data:[^,]+,/, ''))
      const payload = buildPayload({
        photosBase64,
        vibe: 'heartwarming',
        stylizeImages: true,
        style: 'Retro_Toons',
        title: title || 'My photobook',
        context,
        perspective: 'ai',
      })
      await handleGenerate({ payload, previewDataUrls: urls, demo: !getApiUrl() })
    } catch (err) {
      setError(err.message || String(err))
      setView('error')
    }
  }

  function generateFromMemory(memory) {
    const items = (memory.photos || []).map((url, i) => ({ url, meta: (memory.metas && memory.metas[i]) || null }))
    generateQuick(items, memory.title)
  }

  function createPhotobookFromPhotos(photoItems, title) {
    generateQuick(photoItems, title)
  }

  // Re-generate the current book with a new art style + mood, reusing its
  // original photos (and title). Reached from the photobook's final page.
  async function regenerateBook({ style, vibe }) {
    const pages = Array.isArray(book?.pages) ? book.pages : []
    const srcs = pages
      .map((p) => p.original_image || (p.styled_image_b64 ? 'data:image/png;base64,' + p.styled_image_b64 : ''))
      .filter(Boolean)
    if (srcs.length < MIN_PHOTOS) {
      showFlash('Couldn’t find the original photos to re-generate this book.')
      return
    }
    setView('loading')
    setError('')
    try {
      const photosBase64 = srcs.map((s) => s.replace(/^data:[^,]+,/, ''))
      const payload = buildPayload({
        photosBase64,
        vibe,
        stylizeImages: true,
        style,
        title: (book && book.title) || 'My photobook',
        context: '',
        perspective: 'ai',
      })
      await handleGenerate({ payload, previewDataUrls: srcs, demo: !getApiUrl() })
    } catch (err) {
      setError(err.message || String(err))
      setView('error')
    }
  }

  if (view === 'loading') return <Loader />

  if (view === 'story' && book) {
    return (
      <ErrorBoundary onReset={reset}>
        <StoryViewer book={book} onExit={reset} savedId={savedId} onSaved={setSavedId} onRegenerate={regenerateBook} />
        {flash && (
          <div className="app-flash" onClick={() => setFlash('')}>
            {flash}
          </div>
        )}
      </ErrorBoundary>
    )
  }

  // Create a memory — reached from the user profile (kept out of the Memories
  // tab to match Capsyl, which has no "add memory" today).
  if (view === 'newMemory') {
    return (
      <NewMemory
        onCancel={() => setView('memories')}
        onSaved={() => {
          bumpRefresh()
          setView('memories')
        }}
      />
    )
  }

  // The manual "from scratch" creator (upload + story options), reached from the
  // Home CTA. Also where generation errors are shown.
  if (view === 'creator' || view === 'error') {
    return (
      <>
        <TopBar onNavigate={navigate} onUploaded={bumpRefresh} />
        <Creator
          onGenerate={handleGenerate}
          error={view === 'error' ? error : ''}
          buildPayload={buildPayload}
          onOpenSaved={() => setView('saved')}
          onOpenMemories={() => setView('memories')}
          onOpenPhotos={() => setView('photos')}
        />
        <BottomNav active="home" onNavigate={navigate} />
      </>
    )
  }

  // Main tabs share the top bar + bottom nav.
  let tab = null
  let active = view
  if (view === 'explore') {
    tab = <People onBack={() => setView('home')} />
  } else if (view === 'photos') {
    tab = (
      <Photos
        key={'photos-' + refreshKey + '-' + photosFavOnly}
        initialFavOnly={photosFavOnly}
        onBack={() => setView('home')}
        onCreatePhotobook={createPhotobookFromPhotos}
      />
    )
  } else if (view === 'memories') {
    tab = <Memories onCreate={generateFromMemory} onBack={() => setView('home')} />
  } else if (view === 'saved') {
    tab = <SavedBooks onOpen={openSaved} onBack={() => setView('home')} />
  } else {
    active = 'home'
    tab = (
      <Home
        refreshKey={refreshKey}
        onNavigate={navigate}
        onOpenBook={openSavedById}
        onSeeAllFavorites={openFavorites}
        onCreate={() => setView('creator')}
      />
    )
  }

  return (
    <>
      <TopBar onNavigate={navigate} onUploaded={bumpRefresh} />
      {tab}
      <BottomNav active={active} onNavigate={navigate} />
      {flash && (
        <div className="app-flash" onClick={() => setFlash('')}>
          {flash}
        </div>
      )}
    </>
  )
}

function fakeDelay(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
