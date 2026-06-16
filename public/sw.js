// Minimal service worker — present only so the app is installable ("Add to Home
// Screen"). It does NOT cache the app shell (the app needs the live /api/* and
// Genius endpoints), so there's no risk of serving a stale build. Network-only.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {
  /* passthrough — let the browser handle the request normally */
})
