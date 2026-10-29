/* B.A.S Sangha — Firebase Cloud Messaging service worker (background push).
 * Scripts are self-hosted in /firebase/ so the app works without the gstatic CDN.
 * Config values are public by design (Firebase web config). */
importScripts('/firebase/firebase-app-compat.js')
importScripts('/firebase/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAu9nRgX1863S3fTf2e5x4PZIInNxVo4zs',
  authDomain: 'bas-sangha.firebaseapp.com',
  projectId: 'bas-sangha',
  storageBucket: 'bas-sangha.firebasestorage.app',
  messagingSenderId: '14776484645',
  appId: '1:14776484645:web:ea7db447f4ed5aae6890cc',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {}
  const title = n.title || 'B.A.S Sangha'
  const body = n.body || (payload.data && payload.data.body) || ''
  const url = (payload.data && payload.data.url) || '/'
  self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'bas-push',
    data: { url },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(url)
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      })
  )
})
