// Service worker minimo: serve a rendere Fieldbook installabile sul telefono
// e a farla aprire anche quando la linea e' pessima.
const CACHE = 'fieldbook-v4'
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

async function salvaInCache (richiesta, risposta) {
  if (risposta.ok) {
    const c = await caches.open(CACHE)
    await c.put(richiesta, risposta.clone())
  }
  return risposta
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Dati e foto sempre dal vivo: una foto vecchia in cache sarebbe peggio
  // che aspettare un secondo in piu'.
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return

  // La pagina si chiede sempre al server per prima. Senza questo, un telefono
  // che ha gia' installato l'app resterebbe per sempre sulla versione vecchia
  // e le correzioni non arriverebbero mai.
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request)
        .then((res) => salvaInCache(e.request, res))
        .catch(() => caches.match(e.request).then((salvata) => salvata || caches.match('/index.html')))
    )
    return
  }

  // Il resto (grafica, icone) ha il nome che cambia a ogni versione,
  // quindi dalla cache si puo' servire senza rischi.
  e.respondWith(
    caches.match(e.request).then((salvata) =>
      salvata || fetch(e.request)
        .then((res) => salvaInCache(e.request, res))
        .catch(() => caches.match('/index.html'))
    )
  )
})

/* --------------------------------------------------------------- avvisi */

// Arriva un avviso dal server: lo mostriamo sul telefono anche se l'app
// e' chiusa. Il browser pretende che ogni avviso si veda, quindi qui non
// si puo' decidere di non mostrarlo.
self.addEventListener('push', (e) => {
  let dati = {}
  try { dati = e.data ? e.data.json() : {} } catch { dati = {} }

  e.waitUntil(self.registration.showNotification(dati.titolo || 'Fieldbook', {
    body: dati.testo || '',
    icon: '/icona-192.png',
    badge: '/icona-192.png',
    lang: 'it',
    tag: dati.tag || 'fieldbook',
    data: { url: dati.url || '/' }
  }))
})

// Toccando l'avviso si apre il lavoro giusto, non la schermata iniziale.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      for (const f of finestre) {
        if ('focus' in f) {
          if ('navigate' in f) f.navigate(url).catch(() => {})
          return f.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
