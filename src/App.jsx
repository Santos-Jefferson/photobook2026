import { useState } from 'react'
import Creator from './components/Creator'
import StoryViewer from './components/StoryViewer'
import SavedBooks from './components/SavedBooks'
import Memories from './components/Memories'
import Photos from './components/Photos'
import Home from './components/Home'
import People from './components/People'
import BookOptions from './components/BookOptions'
import TopBar from './components/TopBar'
import Loader from './components/Loader'
import ErrorBoundary from './components/ErrorBoundary'
import { generatePhotoBook, buildPayload, buildDemoResponse, fileToOrientedBase64, getApiUrl } from './api'
import { normalizeBook } from './book'
import { getSavedBook } from './bookStorage'
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
  const [pending, setPending] = useState(null) // { photos: [dataURL], title } awaiting options
  const [photosFavOnly, setPhotosFavOnly] = useState(false) // open Photos pre-filtered to favorites

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
      if (bedtime) finalBook = await rewriteBookBedtime(finalBook)

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

  // Both create flows (a Memory or a Photos selection) funnel here: validate the
  // 2–5 rule, then show the options step (mood / style / context) before
  // generating, like the dedicated creator page.
  // `photoItems` is an array of { url, meta } (or bare url strings). meta carries
  // the stored EXIF (date/GPS) so the options step can add date/location context.
  // We pass ALL chosen photos through (capped at a sane upper bound); when there
  // are more than MAX_PHOTOS, the options step lets the user pick which to keep.
  function startBook(photoItems, title, from) {
    const photos = (photoItems || [])
      .map((p) => (typeof p === 'string' ? { url: p, meta: null } : { url: p.url, meta: p.meta || null }))
      .slice(0, 12)
    if (photos.length < MIN_PHOTOS) {
      window.alert(`A photobook needs at least ${MIN_PHOTOS} photos. Add one more and try again.`)
      return
    }
    setPending({ photos, title: title || '', from: from || 'home' })
    setError('')
    setView('bookOptions')
  }

  function generateFromMemory(memory) {
    const items = (memory.photos || []).map((url, i) => ({ url, meta: (memory.metas && memory.metas[i]) || null }))
    startBook(items, memory.title, 'memories')
  }

  function createPhotobookFromPhotos(photoItems, title) {
    startBook(photoItems, title, 'photos')
  }

  // Run generation with the photos + the options chosen on the BookOptions step.
  async function generateWithOptions({ photos, title, context, vibe, style, perspective, stylize, bedtime }) {
    try {
      const urls = photos.map((p) => (typeof p === 'string' ? p : p.url))
      const previewDataUrls = urls // JPEG data URLs
      const photosBase64 = urls.map((d) => d.replace(/^data:[^,]+,/, ''))
      const payload = buildPayload({
        photosBase64,
        vibe,
        stylizeImages: stylize,
        style,
        title: title || 'My photos',
        context,
        perspective,
      })
      await handleGenerate({ payload, previewDataUrls, demo: !getApiUrl(), bedtime })
    } catch (err) {
      setError(err.message || String(err))
      setView('error')
    }
  }

  if (view === 'loading') return <Loader />

  if (view === 'story' && book) {
    return (
      <ErrorBoundary onReset={reset}>
        <StoryViewer book={book} onExit={reset} savedId={savedId} onSaved={setSavedId} />
      </ErrorBoundary>
    )
  }

  // Options step (mood / style / context) before generating from a selection.
  if (view === 'bookOptions' && pending) {
    return (
      <BookOptions
        photos={pending.photos}
        title={pending.title}
        onGenerate={generateWithOptions}
        onBack={() => setView(pending.from || 'home')}
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
    </>
  )
}

function fakeDelay(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
