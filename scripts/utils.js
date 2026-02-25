let serviceWorkerRegistrationStarted = false;

export function initGlobal() {
  if (!("serviceWorker" in navigator)) {
    console.info("[UniFacens SOS] Service Worker nao suportado neste navegador.");
    return;
  }

  if (serviceWorkerRegistrationStarted) return;
  serviceWorkerRegistrationStarted = true;

  const swUrl = new URL("../service-worker.js", import.meta.url);
  const swScope = new URL("../", swUrl).pathname;

  navigator.serviceWorker
    .register(swUrl.href, { scope: swScope })
    .then((registration) => {
      console.info("[UniFacens SOS] Service Worker registrado:", registration.scope);
    })
    .catch((error) => {
      console.warn("[UniFacens SOS] Falha ao registrar Service Worker:", error);
    });
}
