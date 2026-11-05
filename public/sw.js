const CACHE = "aura-shell-v5";
const PRECACHE = ["/offline", "/icon.svg", "/artwork/local.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(async (response) => {
      if (response.ok) await caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/offline"))));
    return;
  }
  if (PRECACHE.includes(url.pathname)) event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
