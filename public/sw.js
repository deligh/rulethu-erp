// Rulethu ERP service worker — kept intentionally minimal during active
// development: it enables "Add to Home Screen" / installability but does NOT
// cache responses, so every load is always the latest (no stale bundles).
// Offline caching can be reintroduced once the app settles.
const CACHE_PREFIX = "rulethu-erp";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // purge every old cache this app ever created
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Empty fetch handler (does not call respondWith) → the browser handles every
// request normally and always fetches fresh. Presence of the handler keeps the
// app installable.
self.addEventListener("fetch", () => {});
