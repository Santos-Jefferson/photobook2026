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
    el.className = 'fatal'
    document.body.appendChild(el)
  }
  const h2 = document.createElement('h2')
  h2.textContent = title
  const pre = document.createElement('pre')
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary onReset={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
