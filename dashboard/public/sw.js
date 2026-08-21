const SHELL_CACHE = "tikchop-shell-v7";
const ASSET_CACHE = "tikchop-assets-v7";
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
  "tikchop-shell-v6",
  "tikchop-assets-v6",
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

self.addEventListener("push", (event) => {
  let data = { title: "Tikchop", body: "", url: "/dashboard" };

  try {
    const payload = event.data?.json();
    if (payload) {
      data = { ...data, ...payload };
    }
  } catch (error) {
    const text = event.data?.text();
    if (text) data.body = text;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Tikchop", {
      body: data.body || "",
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.focus();
          client.navigate?.(url);
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Tikchop</title><body style=\"margin:0;font-family:system-ui;background:#f6fbf7;color:#0f2b20;display:grid;min-height:100vh;place-items:center;text-align:center;padding:24px\"><main><strong style=\"font-size:22px\">Connexion indisponible</strong><p style=\"font-weight:700;color:#54685e\">Reconnectez internet puis actualisez Tikchop.</p></main></body>",
            {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            },
          );
        }
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    // Chunks _next/ immutables (hachés) : stale-while-revalidate pour servir
    // le shell offline sans bloquer sur le réseau.
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
