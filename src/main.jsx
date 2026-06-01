import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// A render error that isn't caught by an error boundary makes React 18 unmount
// the whole tree, leaving just the dark body background — i.e. the "black
// screen". Error boundaries also can't catch errors thrown outside React's
// render cycle (async callbacks, promise rejections, event handlers). These
// global listeners surface those instead of letting the screen go silently
// black, so there's always something to read.
function showFatalOverlay(title, message) {
  let el = document.getElementById('fatal-overlay')
  if (!el) {
    el = document.createElement('div')
    el.id = 'fatal-overlay'
    // Inline styles so the overlay is visible even if the stylesheet failed to
    // load — we never want the diagnostic itself to be a black screen.
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;overflow:auto;padding:32px;' +
      'background:#1a0d0d;color:#ffd9d9;font:14px/1.5 ui-monospace,monospace'
    document.body.appendChild(el)
  }
  const h2 = document.createElement('h2')
  h2.style.cssText = 'color:#ff8a8a;margin:0 0 12px'
  h2.textContent = title
  const pre = document.createElement('pre')
  pre.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin:0'
  pre.textContent = message
  el.replaceChildren(h2, pre)
}

window.addEventListener('error', (e) => {
  console.error('[Photobook] uncaught error:', e.error || e.message)
  showFatalOverlay('Something broke (uncaught error)', String(e.error?.stack || e.message || e))
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Photobook] unhandled promise rejection:', e.reason)
  showFatalOverlay('Something broke (unhandled rejection)', String(e.reason?.stack || e.reason))
})

console.log('[Photobook] boot · build 2026-06-01 · capsyl-style light theme')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary onReset={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
