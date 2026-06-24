/* Service Worker: PWA (fetch) + Web Push */

/** Necessário para o Chrome considerar a app instalável (critério PWA). */
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Notificação', body: event.data.text() || '' };
  }
  const title = payload.title || 'Sistema de Tickets';
  const body = payload.body || 'Nova atividade';
  const url = payload.url || '/tickets';
  const tag = payload.tag || 'ticket-notification';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: new URL('images/favicon/favicon-96x96.png', self.location).href,
      badge: new URL('images/favicon/favicon-96x96.png', self.location).href,
      tag,
      data: { url },
      requireInteraction: false,
      actions: [{ action: 'open', title: 'Abrir' }],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/tickets';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl);
    })
  );
});
