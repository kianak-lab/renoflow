/* eslint-disable no-undef */
/**
 * RenoFlow PWA service worker — VERSION is injected per deployment build.
 * Navigations and RSC fetches bypass the HTTP cache so new deploys load immediately.
 */
const VERSION = __BUILD_VERSION__;
const CACHE_PREFIX = `renoflow-${VERSION}`;

self.addEventListener("install", () => {
  // Defer activation until the client sends SKIP_WAITING (update) or first install handshake.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_PREFIX)) return caches.delete(key);
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, {
        cache: "no-store",
        credentials: "same-origin",
      }).catch(() => fetch(req)),
    );
    return;
  }

  if (req.method === "GET") {
    try {
      const url = new URL(req.url);
      const isRsc =
        url.searchParams.has("_rsc") ||
        (req.headers.get("RSC") || "") === "1" ||
        (req.headers.get("Next-Router-Prefetch") || "") === "1";
      if (isRsc) {
        event.respondWith(
          fetch(req, {
            cache: "no-store",
            credentials: "same-origin",
          }).catch(() => fetch(req)),
        );
      }
    } catch {
      /* ignore */
    }
  }
});
