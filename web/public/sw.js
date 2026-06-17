// Minimal service worker for the Haushalts-Cockpit PWA.
// Purpose: installability + an offline fallback for navigations. It does NOT
// cache task data — the dashboard is force-dynamic and must always be fresh,
// so only the static offline shell is cached.
const CACHE = "cockpit-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only intervene on page navigations: try the network, fall back to the
  // cached offline page when the tablet/phone has no connection.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Cockpit", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((c) => "focus" in c);
        if (open) return open.focus();
        return self.clients.openWindow(url);
      }),
  );
});
