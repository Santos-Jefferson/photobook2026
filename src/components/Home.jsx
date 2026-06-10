import { useEffect, useState } from 'react'
import { listPhotos } from '../photoStore'
import { listSavedBooks } from '../bookStorage'
import { listMemories } from '../memoryStore'

// The Home dashboard (Capsyl-style): a quick look at recent photos, favorites,
// photobooks and memories. Everything taps through to its full tab.
export default function Home({ refreshKey, onNavigate, onOpenBook, onCreate, onSeeAllFavorites }) {
  const [photos, setPhotos] = useState([])
  const [books, setBooks] = useState([])
  const [memories, setMemories] = useState([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [ph, bk, me] = await Promise.all([
        listPhotos().catch(() => []),
        listSavedBooks().catch(() => []),
        listMemories().catch(() => []),
      ])
      if (!alive) return
      setPhotos(ph)
      setBooks(bk)
      setMemories(me)
    })()
    return () => {
      alive = false
    }
  }, [refreshKey])

  const recent = photos.slice(0, 8)
  const favorites = photos.filter((p) => p.favorite).slice(0, 8)
  const empty = photos.length === 0 && books.length === 0 && memories.length === 0

  return (
    <div className="home">
      {empty && (
        <div className="home-welcome">
          <h2>Welcome 👋</h2>
          <p>Add a few photos to get started — then turn them into a narrated photobook.</p>
          <button className="home-welcome-cta" onClick={() => onNavigate('photos')}>
            ＋ Add photos
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <Section title="Recent Photos" onSeeAll={() => onNavigate('photos')}>
          <div className="home-grid">
            {recent.map((p) => (
              <button key={p.id} className="home-cell" onClick={() => onNavigate('photos')}>
                <img src={p.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {favorites.length > 0 && (
        <Section title="Recent Favorites" onSeeAll={onSeeAllFavorites}>
          <div className="home-grid">
            {favorites.map((p) => (
              <button key={p.id} className="home-cell" onClick={() => onNavigate('photos')}>
                <img src={p.url} alt="" loading="lazy" />
                <span className="home-cell-fav" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      fill="#ff4d6d"
                      d="M12 20s-7-4.5-9.3-9C1.2 8.3 2.6 5 5.8 5 8 5 9.4 6.7 12 9.5 14.6 6.7 16 5 18.2 5c3.2 0 4.6 3.3 3.1 6-2.3 4.5-9.3 9-9.3 9z"
                    />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {books.length > 0 && (
        <Section title="Recent Photobooks" onSeeAll={() => onNavigate('saved')}>
          <div className="home-rail">
            {books.slice(0, 8).map((b) => (
              <button key={b.id} className="home-book" onClick={() => onOpenBook(b.id)}>
                <span className="home-book-cover">
                  {b.cover ? <img src={b.cover} alt="" /> : <span className="home-book-blank">📖</span>}
                </span>
                <span className="home-book-title">{b.title}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {memories.length > 0 && (
        <Section title="Recent Memories" onSeeAll={() => onNavigate('memories')}>
          <div className="home-rail">
            {memories.slice(0, 8).map((m) => (
              <button key={m.id} className="home-memory" onClick={() => onNavigate('memories')}>
                <img src={m.photos[0]} alt="" />
                <span className="home-memory-scrim" />
                <span className="home-memory-title">{m.title}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {!empty && (
        <button className="home-create-cta" onClick={onCreate}>
          ✨ Create a photobook
        </button>
      )}
    </div>
  )
}

function Section({ title, onSeeAll, children }) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>{title}</h2>
        {onSeeAll && (
          <button className="home-see-all" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
