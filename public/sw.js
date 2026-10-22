// A deliberately minimal service worker: it exists so the site counts as
// installable (Add to Home Screen with its own icon, no browser bar) and it
// caches nothing, so every open gets the latest build. Offline support can
// come later, once the app is in use and the trade-offs are clear.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
