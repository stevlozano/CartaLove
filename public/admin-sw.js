const CACHE = "admin-carta-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/admin-manifest.json"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    ))
  );
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Admin Carta", body: "", icon: "/favicon.ico" };
  try { if (event.data) data = JSON.parse(event.data.text()); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, icon: data.icon, badge: "/favicon.ico", vibrate: [200, 100, 200] })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/admin") && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/admin");
    })
  );
});
