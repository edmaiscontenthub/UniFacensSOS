async function hasInternetConnection() {
  if (!navigator.onLine) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  const probeUrl = `https://connectivitycheck.gstatic.com/generate_204?ts=${Date.now()}`;

  try {
    // Probe publico de conectividade (Android/iOS), sem depender do cache local.
    await fetch(probeUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function openOfflineLightbox() {
  const lightbox = document.getElementById("offlineLightbox");
  if (!lightbox) return;

  lightbox.classList.remove("is-hidden");
  lightbox.setAttribute("aria-hidden", "false");
}

function closeOfflineLightbox() {
  const lightbox = document.getElementById("offlineLightbox");
  if (!lightbox) return;

  lightbox.classList.add("is-hidden");
  lightbox.setAttribute("aria-hidden", "true");
}

export function init() {
  const messageBtn = document.getElementById("message");
  const offlineOkBtn = document.getElementById("offlineOkBtn");
  const offlineLightbox = document.getElementById("offlineLightbox");

  if (!messageBtn) return;

  messageBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    if (await hasInternetConnection()) {
      window.location.href = messageBtn.href;
      return;
    }

    openOfflineLightbox();
  });

  if (offlineOkBtn) {
    offlineOkBtn.addEventListener("click", closeOfflineLightbox);
  }

  if (offlineLightbox) {
    offlineLightbox.addEventListener("click", (event) => {
      if (event.target === offlineLightbox) closeOfflineLightbox();
    });
  }
}