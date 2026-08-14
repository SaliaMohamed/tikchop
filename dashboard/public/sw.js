const SHELL_CACHE = "tikchop-shell-v6";
const ASSET_CACHE = "tikchop-assets-v6";
const LEGACY_CACHES = [
  "tikchop-shell-v1",
  "tikchop-runtime-v1",
  "tikchop-shell-v2",
  "tikchop-runtime-v2",
  "tikchop-shell-v3",
  "tikchop-assets-v3",
  "tikchop-shell-v4",
  "tikchop-assets-v4",
  "tikchop-shell-v5",
  "tikchop-assets-v5",
];

const SHELL_FILES = [
  "/install",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => LEGACY_CACHES.includes(key) || ![SHELL_CACHE, ASSET_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Tikchop</title><body style=\"margin:0;font-family:system-ui;background:#f6fbf7;color:#0f2b20;display:grid;min-height:100vh;place-items:center;text-align:center;padding:24px\"><main><strong style=\"font-size:22px\">Connexion indisponible</strong><p style=\"font-weight:700;color:#54685e\">Reconnectez internet puis actualisez Tikchop.</p></main></body>",
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      )),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  const shouldCacheAsset = [
    "/landing/",
    "/payment-logos/",
    "/icon-",
    "/maskable-",
    "/apple-touch-icon",
    "/manifest.json",
  ].some((prefix) => url.pathname.startsWith(prefix));

  if (!shouldCacheAsset) return;

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
