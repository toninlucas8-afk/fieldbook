// Service worker minimo: serve a rendere Fieldbook installabile sul telefono
// e a farla aprire anche quando la linea e' pessima.
const CACHE = 'fieldbook-v1'
const GUSCIO = ['/', '/index.html', '/manifest.webmanifest', '/icona.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Dati e foto sempre dal vivo: una foto vecchia in cache sarebbe peggio
  // che aspettare un secondo in piu'.
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return

  e.respondWith(
    caches.match(e.request).then((salvata) =>
      salvata || fetch(e.request).then((res) => {
        if (res.ok) {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, copia))
        }
        return res
      }).catch(() => caches.match('/index.html'))
    )
  )
})
