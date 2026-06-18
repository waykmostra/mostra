/* Mostra — Service Worker (Web Push)
 * Reçoit les notifications push et gère le clic.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'Mostra', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Mostra'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Réutilise un onglet/PWA déjà ouvert s'il existe
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client && url) {
            try {
              client.navigate(url)
            } catch (e) {
              /* navigation cross-origin impossible — ignore */
            }
          }
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
