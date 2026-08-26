// Inbox PWA service worker.
// Caches the app shell so the capture UI opens instantly and works offline.
// API calls to your backend are NEVER cached — they always hit the network
// (and the app's own offline queue handles failures). That matters more now
// that /today, /context and /list all read live state: a cached response
// would show a stale day or a stale errand list, which is exactly the
// problem this app exists to avoid.
//
// BUMP `CACHE` ON EVERY index.html CHANGE. The shell is served cache-first,
// so a stale version string means the phone keeps running the old app no
// matter what was deployed.

const CACHE = "inbox-shell-v8";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

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
  // Only cache same-origin GETs (the shell). Let everything else — including
  // POSTs to the Cloud Run backend — go straight to the network.
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