// Capsyl-style bottom navigation, shown on mobile only (hidden on desktop via
// CSS). Switches between the app's main destinations.
const ITEMS = [
  { key: 'create', icon: '✏️', label: 'Create' },
  { key: 'photos', icon: '🖼️', label: 'Photos' },
  { key: 'memories', icon: '✨', label: 'Memories' },
  { key: 'saved', icon: '📚', label: 'Saved' },
]

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`bottom-nav-item ${active === it.key ? 'active' : ''}`}
          onClick={() => onNavigate(it.key)}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            {it.icon}
          </span>
          <span className="bottom-nav-label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
