let serviceWorkerRegistrationStarted = false;
let autoReloadRegistered = false;

const UPDATE_RELOAD_DONE_KEY = "unifacens-sos:sw-reload-done-session";

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // storage pode ser bloqueado em navegacao privada/restrita
  }
}

function wasReloadDoneInSession() {
  return safeGet(sessionStorage, UPDATE_RELOAD_DONE_KEY) === "1";
}

function markReloadDoneInSession() {
  safeSet(sessionStorage, UPDATE_RELOAD_DONE_KEY, "1");
}

function registerAutoReloadOnControllerChange() {
  if (autoReloadRegistered) return;
  autoReloadRegistered = true;
  let ignoreNextControllerChange = !navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (ignoreNextControllerChange) {
      ignoreNextControllerChange = false;
      return;
    }

    if (wasReloadDoneInSession()) return;

    markReloadDoneInSession();
    window.location.reload();
  });
}

function scheduleUpdateCheck(registration) {
  const run = async () => {
    try {
      await registration.update();
      console.info("[UniFacens SOS] Verificacao de atualizacao do app concluida.");
    } catch (error) {
      // Offline ou falha temporaria: o Service Worker atual e seu cache continuam ativos.
      console.info("[UniFacens SOS] Atualizacao indisponivel; usando a versao em cache.", error);
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
    return;
  }

  setTimeout(run, 300);
}

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
      registerAutoReloadOnControllerChange();
      scheduleUpdateCheck(registration);
    })
    .catch((error) => {
      console.warn("[UniFacens SOS] Falha ao registrar Service Worker:", error);
    });
}
