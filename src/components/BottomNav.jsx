// Capsyl-style bottom navigation, shown on mobile only (hidden on desktop via
// CSS). The five tab glyphs are the real Capsyl wl-icon paths, inlined as SVG
// with fill="currentColor" so they render reliably and recolor (gray → teal)
// with the active state — no external asset or CSS mask to fail.
//
// Capsyl's bar has five tabs (Home, Explore, Photos, Memories, Library). We map
// them to the screens this app actually has; Explore is a stub that returns to
// Home until it has its own screen.

const Svg = ({ children }) => (
  <svg className="bottom-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
)

// wl-icon-cloud
const HomeIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      fillRule="nonzero"
      d="M11.73 5a5.82 5.82 0 0 0-3.21 1 7 7 0 0 0-2.95 4.59A4.09 4.09 0 0 0 2 14.78 4.05 4.05 0 0 0 5.86 19H17.2a5.14 5.14 0 0 0 4.8-5.41 5.09 5.09 0 0 0-4.78-5.28h-.13A6.2 6.2 0 0 0 11.73 5Z"
    />
  </Svg>
)

// wl-icon-explore
const ExploreIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      fillRule="evenodd"
      transform="translate(3 3)"
      d="m7.28338538 6.92597864 5.01208942-1.83158493c.2671783-.06978801.5403435.09022844.6101315.35740674.0216412.08285171.0216412.16987303 0 .25272474l-1.8315849 5.01208941c-.0457146.175015-.1823918.3116922-.3574068.3574068l-5.01208941 1.8315849c-.26717831.069788-.54034347-.0902285-.61013148-.3574068-.02164119-.0828517-.02164119-.169873 0-.2527247l1.83158493-5.01208942c.0457146-.175015.18239174-.31169214.35740674-.35740674zm-7.28338538 2.07402136c0 4.971 4.029 9 9 9 4.97 0 9-4.029 9-9 0-4.97-4.03-9-9-9-4.971 0-9 4.03-9 9z"
    />
  </Svg>
)

// wl-icon-photo
const PhotosIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M20 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16Zm-9.727 5.314-5.952 8.242a.28.28 0 0 0 .227.444H19.44a.28.28 0 0 0 .224-.448l-3.94-5.253a.28.28 0 0 0-.448 0l-1.219 1.626-3.33-4.61a.28.28 0 0 0-.454 0ZM17.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
    />
  </Svg>
)

// wl-icon-memories
const MemoriesIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      clipRule="evenodd"
      d="m5.24 2.10477c.191-.15883.477-.13417.637.05426l1.078 1.26571.113.13219.022-.01874c1.49-.82967 3.188-1.26867 4.91-1.26867 5.514 0 10 4.42555 10 9.86528 0 5.4397-4.486 9.8652-10 9.8652s-10-4.4255-10-9.8652c0-.7399.083-1.4779.248-2.19407.098-.42421.526-.68761.957-.59487.432.09668.701.51989.604.94504-.139.6018-.209 1.2223-.209 1.8439 0 4.5695 3.768 8.2868 8.4 8.2868s8.4-3.7173 8.4-8.2868c0-4.56962-3.768-8.28684-8.4-8.28684-1.355 0-2.687.33443-3.878.94903l.064.07498 1.078 1.26867c.063.07399.099.16574.105.26143.014.24663-.177.45775-.427.47156l-4.408.24663c-.044.00197-.088-.00099-.131-.01184-.243-.05722-.393-.29793-.335-.53864l1.022-4.22726c.023-.09273.075-.17659.15-.23775zm6.7176 4.52459c.257 0 .472.19139.497.44394l.455 4.4887 3.248 1.831c.156.0878.252.2515.252.4281v.2072c0 .2082-.171.3768-.382.3768-.033 0-.068-.0049-.1-.0138l-4.619-1.242c-.231-.0631-.386-.2782-.367-.514l.432-5.55115c.021-.25649.238-.45479.499-.45479z"
    />
  </Svg>
)

// wl-icon-library
const LibraryIcon = () => (
  <Svg>
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M4.5 3A1.5 1.5 0 0 1 6 4.5v15a1.5 1.5 0 0 1-1.356 1.493L4.5 21A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3Zm5.112 0a1.5 1.5 0 0 1 1.5 1.5v15a1.5 1.5 0 0 1-1.355 1.493L9.612 21a1.5 1.5 0 0 1-1.5-1.5v-15a1.5 1.5 0 0 1 1.5-1.5Zm6.534 1.802 4.776 14.22a1.5 1.5 0 0 1-.81 1.847l-.134.052a1.5 1.5 0 0 1-1.9-.944l-4.775-14.22a1.5 1.5 0 0 1 2.843-.955Z"
    />
  </Svg>
)

const ITEMS = [
  { key: 'create', view: 'create', Icon: HomeIcon, label: 'Home' },
  { key: 'explore', view: 'create', Icon: ExploreIcon, label: 'Explore' },
  { key: 'photos', view: 'photos', Icon: PhotosIcon, label: 'Photos' },
  { key: 'memories', view: 'memories', Icon: MemoriesIcon, label: 'Memories' },
  { key: 'saved', view: 'saved', Icon: LibraryIcon, label: 'Library' },
]

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {ITEMS.map(({ key, view, Icon, label }) => (
        <button
          key={key}
          className={`bottom-nav-item ${active === key ? 'active' : ''}`}
          onClick={() => onNavigate(view)}
        >
          <Icon />
          <span className="bottom-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
