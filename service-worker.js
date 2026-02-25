const CACHE_VERSION = "unifacens-sos-v2"; // Atualize este valor para forçar atualização do cache (ex.: "unifacens-sos-v2").
const CACHE_PREFIX = "unifacens-sos-";
const CACHE_NAME = CACHE_VERSION;

// Usa o scope real do SW para funcionar em "/" e também em subpastas (GitHub Pages).
const SCOPE_URL = new URL(self.registration.scope);
const BASE_PATH = SCOPE_URL.pathname.endsWith("/") ? SCOPE_URL.pathname : `${SCOPE_URL.pathname}/`;

function toScopedUrl(path) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, SCOPE_URL).toString();
}

const APP_SHELL_PATHS = [
  "index.html",
  "manifest.json",

  "pages/home.html",
  "pages/call.html",
  "pages/message.html",
  "pages/map.html",

  "styles/app.css",
  "styles/global.css",
  "styles/home.css",
  "styles/call.css",
  "styles/message.css",
  "styles/map.css",
  "styles/utils.css",

  "scripts/app.js",
  "scripts/home.js",
  "scripts/call.js",
  "scripts/message.js",
  "scripts/map.js",
  "scripts/utils.js",

  "assets/images/unifacens-logo.svg",
  "assets/images/sos.svg",
  "assets/images/call.svg",
  "assets/images/call-hover.svg",
  "assets/images/message.svg",
  "assets/images/message-hover.svg",
  "assets/images/return.svg",
  "assets/images/gatehouse.svg",
  "assets/images/gatehouse-hover.svg",
  "assets/images/clinic.svg",
  "assets/images/clinic-hover.svg",
  "assets/images/occupational-safety.svg",
  "assets/images/occupational-safety-hover.svg",
  "assets/images/fire.svg",
  "assets/images/fire-hover.svg",
  "assets/images/first-aid.svg",
  "assets/images/first-aid-hover.svg",
  "assets/images/risk.svg",
  "assets/images/risk-hover.svg",
  "assets/images/other.svg",
  "assets/images/other-hover.svg",
  "assets/images/edmais-logo.svg",

  "assets/icons/icon.svg",
  "assets/icons/apple-touch-icon-180.png"
];

const APP_SHELL_URLS = APP_SHELL_PATHS.map(toScopedUrl);
const HOME_FALLBACK_URL = toScopedUrl("pages/home.html");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request, { ignoreSearch: true });
  const safeCachedResponse = await toSafeNavigationResponse(cachedResponse);
  if (safeCachedResponse) return safeCachedResponse;

  try {
    // Em alguns hosts (ex.: Cloudflare), navegações podem responder com redirect HTTP.
    // Forçamos redirect=follow para não retornar opaqueredirect ao navegador.
    const networkResponse = await fetch(request.url, { redirect: "follow" });
    const safeNetworkResponse = await toSafeNavigationResponse(networkResponse);
    if (safeNetworkResponse && safeNetworkResponse.ok) {
      cache.put(request, safeNetworkResponse.clone());
    }
    if (safeNetworkResponse) return safeNetworkResponse;
    throw new Error("Unsafe redirected navigation response");
  } catch (error) {
    const fallbackHome = await toSafeNavigationResponse(await cache.match(HOME_FALLBACK_URL));
    if (fallbackHome) return fallbackHome;

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=UTF-8" }
    });
  }
}

async function toSafeNavigationResponse(response) {
  if (!response) return null;
  if (!response.redirected) return response;

  // Evita devolver redirected response em request.mode === "navigate".
  try {
    const body = await response.blob();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch {
    return null;
  }
}

async function cacheFirstWithUpdate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    networkPromise.catch(() => {});
    return cachedResponse;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  return new Response("Offline", {
    status: 504,
    statusText: "Gateway Timeout",
    headers: { "Content-Type": "text/plain; charset=UTF-8" }
  });
}

function isLocalAssetRequest(request) {
  const destination = request.destination;
  if (destination === "style" || destination === "script" || destination === "image") {
    return true;
  }

  const pathname = new URL(request.url).pathname;
  return /\.(?:css|js|svg|png|jpg|jpeg|gif|webp)$/i.test(pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Não interfere em recursos externos (ex.: Google Fonts).
  if (url.origin !== self.location.origin) return;

  // Restringe atuação ao mesmo base path do app.
  if (!url.pathname.startsWith(BASE_PATH)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isLocalAssetRequest(request)) {
    event.respondWith(cacheFirstWithUpdate(request));
  }
});
