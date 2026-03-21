// Минимальный Service Worker для Кассандры
// Обрабатывает push-уведомления и утренние напоминания

self.addEventListener('install', function(event) {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

// Обработка push-уведомлений
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || 'Кассандра 🔮';
  var options = {
    body: data.body || 'Новый сигнал из ноосферы',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'cassandra-push',
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Обработка сообщений от клиента (утреннее напоминание)
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'MORNING_REMINDER') {
    self.registration.showNotification('Кассандра 🔮', {
      body: 'Что вам приснилось? Запишите пока помните 🔮',
      icon: '/icon-192.png',
      tag: 'morning-reminder',
    });
  }
});

// Клик по уведомлению — открыть приложение
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Если приложение уже открыто — фокусируемся на него
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Иначе — открываем новое окно
      if (self.clients.openWindow) {
        return self.clients.openWindow('/feed');
      }
    })
  );
});
