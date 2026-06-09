// Capsyl-style bottom navigation, shown on mobile only (hidden on desktop via
// CSS). Uses the real Capsyl wl-icon SVGs, recolored via CSS mask so the active
// tab can glow teal like the app. Switches between the app's destinations.
//
// Capsyl's bar has five tabs (Home, Explore, Photos, Memories, Library). We map
// them to the screens this app actually has; Explore is a stub that returns to
// Home until it has its own screen.
import iconHome from '../assets/capsyl/wl-icon-cloud.svg'
import iconExplore from '../assets/capsyl/wl-icon-explore.svg'
import iconPhotos from '../assets/capsyl/wl-icon-photo.svg'
import iconMemories from '../assets/capsyl/wl-icon-memories.svg'
import iconLibrary from '../assets/capsyl/wl-icon-library.svg'

const ITEMS = [
  { key: 'create', view: 'create', icon: iconHome, label: 'Home' },
  { key: 'explore', view: 'create', icon: iconExplore, label: 'Explore' },
  { key: 'photos', view: 'photos', icon: iconPhotos, label: 'Photos' },
  { key: 'memories', view: 'memories', icon: iconMemories, label: 'Memories' },
  { key: 'saved', view: 'saved', icon: iconLibrary, label: 'Library' },
]

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`bottom-nav-item ${active === it.key ? 'active' : ''}`}
          onClick={() => onNavigate(it.view)}
        >
          <span
            className="bottom-nav-icon"
            aria-hidden="true"
            style={{ WebkitMaskImage: `url(${it.icon})`, maskImage: `url(${it.icon})` }}
          />
          <span className="bottom-nav-label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
