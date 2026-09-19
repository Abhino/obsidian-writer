// Board service worker. Scope is /dashboard/ — the capture app's worker at
// the site root keeps its own scope, so the two apps never evict each
// other's shell.
//
// BUMP `CACHE` ON EVERY index.html CHANGE. The shell is cache-first, so a
// stale version string means you keep running the old board.
const CACHE = "board-shell-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./sortable.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Shell only. /board and /move must never be cached: a cached board is a
  // stale plan, which is the one thing this app cannot show.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
