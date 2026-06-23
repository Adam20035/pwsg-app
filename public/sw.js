// Service Worker — obsługa powiadomień push
self.addEventListener('push', function(event) {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: '/logo_wat.png',
    badge: '/logo_wat.png',
    data: { url: data.url || '/' },
    requireInteraction: false,
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Platforma Wydarzen Studenckich', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
