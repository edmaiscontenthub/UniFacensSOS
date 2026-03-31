// ======================
// CONFIG
// ======================
const NUMERO_DESTINO_PADRAO = "5515991966412";
const TIPO_PADRAO_EMERGENCIA = "EMERGÊNCIA";

const DESTINO_CONFIG_POR_TIPO = {
  "PRIMEIROS SOCORROS": {
    numero: "5515981403334",
    diasDesabilitados: [1, 7], // 1=domingo, 7=sabado
  },
  // "INCÊNDIO": {
  //   numero: "5515991966412",
  //   diasDesabilitados: [],
  // },
};

const META_INICIAL_M = 10;
const AUMENTO_META_M = 5;
const AUMENTO_META_MS = 2500;

const ESPERA_COORDS_MS = 3000;
const LIBERAR_MANUAL_MS = 3000;
const TENTATIVA_MAX_MS = 10000;
const TICK_MELHORIA_MS = 500;
const RETRY_WATCH_MS = 2000;

const FLOW_STATE = Object.freeze({
  IDLE: "idle",
  REQUESTING_LOCATION: "requesting-location",
  IMPROVING_LOCATION: "improving-location",
  READY_TO_SEND: "ready-to-send",
});

const UI_COPY = Object.freeze({
  initialTitle: "ATIVE A LOCALIZAÇÃO!",
  initialSubtitle: "Ative o GPS e permita o acesso, se solicitado.",
  initialHint: "Isso pode levar alguns segundos.",
  initialAccuracy: "—",
  initialTarget: "—",
  fallbackButton: "Enviar sem localização",
  manualButton: "Enviar sem precisão",
  readyButton: "Abrir WhatsApp",
  improvingTitle: "Aguarde, buscando localização…",
  improvingSubtitle: "Melhorando a precisão do GPS.",
  improvingHint: "Isso pode levar alguns segundos.",
  manualHint: "Se a meta não for atingida, você ainda pode enviar manualmente.",
  readyTitle: "Pronto!",
});

// ======================
// STATE
// ======================
function createRuntimeState() {
  return {
    currentState: FLOW_STATE.IDLE,
    selectedType: TIPO_PADRAO_EMERGENCIA,
    coordsConfirmed: false,

    lastLat: null,
    lastLon: null,
    lastAcc: null,

    bestLat: null,
    bestLon: null,
    bestAcc: null,
    targetAccuracy: null,

    pendingWhatsAppUrl: null,

    watchId: null,
    waitCoordsTimeoutId: null,
    manualReleaseTimeoutId: null,
    maxAttemptTimeoutId: null,
    increaseTargetIntervalId: null,
    improvementTickIntervalId: null,
    retryWatchTimeoutId: null,
  };
}

let runtime = createRuntimeState();

// ======================
// DOM
// ======================
const dom = {
  lightbox: () => document.getElementById("lightbox"),
  title: () => document.getElementById("lbTitle"),
  subtitle: () => document.getElementById("lbSubtitle"),
  hint: () => document.getElementById("lbHint"),
  accuracy: () => document.getElementById("lbAccuracy"),
  target: () => document.getElementById("lbTarget"),
  btnPrimary: () => document.getElementById("btnForcar"),
  btnClose: () => document.getElementById("btnCloseLightbox"),
  spinner: () => document.querySelector(".lb__spinner"),
  typeButtons: () => document.querySelectorAll("body[data-page='message'] .grid .btn[data-emergency-type]"),
};

// ======================
// DESTINATION POLICY
// ======================
function normalizarTipo(tipo) {
  return String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const DESTINO_CONFIG_NORMALIZADO_POR_TIPO = Object.fromEntries(
  Object.entries(DESTINO_CONFIG_POR_TIPO).map(([tipo, config]) => [
    normalizarTipo(tipo),
    config,
  ])
);

function getWeekdaySaoPaulo(date = new Date()) {
  const weekdayName = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  }).format(date);

  const weekdayNormalized = String(weekdayName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const map = {
    "domingo": 1,
    "segunda-feira": 2,
    "terca-feira": 3,
    "quarta-feira": 4,
    "quinta-feira": 5,
    "sexta-feira": 6,
    "sabado": 7,
  };

  return map[weekdayNormalized];
}

function obterNumeroDestinoPorTipo(tipo) {
  const tipoNormalizado = normalizarTipo(tipo);
  const config = DESTINO_CONFIG_NORMALIZADO_POR_TIPO[tipoNormalizado];
  if (!config?.numero) return NUMERO_DESTINO_PADRAO;

  const diaAtual = getWeekdaySaoPaulo();
  if (config.diasDesabilitados?.includes(diaAtual)) {
    return NUMERO_DESTINO_PADRAO;
  }

  return config.numero;
}

// ======================
// MESSAGE / MAP POLICY
// ======================
function coordenadasValidas(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lonNum < -180 || lonNum > 180) return false;
  if (latNum === 0 && lonNum === 0) return false;

  return true;
}

function obterRootDoSite() {
  const { origin, pathname } = window.location;
  const antesDePages = pathname.split("/pages/")[0];
  return origin + antesDePages;
}

function gerarLinkMapa(lat, lon) {
  const root = obterRootDoSite();
  const url = new URL(root + "/pages/map.html");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  return url.toString();
}

function textoLinkMapaOuNaoDisponivel(lat, lon) {
  return coordenadasValidas(lat, lon)
    ? gerarLinkMapa(Number(lat), Number(lon))
    : "Não disponível.";
}

function textoPrecisaoOuNaoDisponivel(lat, lon, acc) {
  const temCoords = coordenadasValidas(lat, lon);
  return (temCoords && acc != null)
    ? `${Math.round(acc)} metros`
    : "Não disponível.";
}

function montarUrlWhatsApp(lat, lon, accuracy) {
  const numeroDestino = obterNumeroDestinoPorTipo(runtime.selectedType);
  const link = textoLinkMapaOuNaoDisponivel(lat, lon);
  const prec = textoPrecisaoOuNaoDisponivel(lat, lon, accuracy);

  const msg = [
    "PEDIDO DE AJUDA",
    "",
    `Tipo: ${runtime.selectedType}`,
    "",
    `Precisão: ${prec}`,
    "",
    `Localização: ${link}`,
  ].join("\n");

  return `https://wa.me/${numeroDestino}?text=${encodeURIComponent(msg)}`;
}

function abrirWhatsApp(url) {
  const popup = window.open(url, "_blank");
  if (!popup) window.location.href = url;
}

function montarUrlSemLocalizacao() {
  return montarUrlWhatsApp(null, null, null);
}

function montarUrlComMelhorLeituraOuFallback() {
  if (coordenadasValidas(runtime.bestLat, runtime.bestLon)) {
    return montarUrlWhatsApp(runtime.bestLat, runtime.bestLon, runtime.bestAcc);
  }

  return montarUrlSemLocalizacao();
}

// ======================
// UI RENDER
// ======================
function setText(el, value) {
  if (el && value != null) el.textContent = value;
}

function fmtAcc(acc) {
  return acc != null ? `${Math.round(acc)}m` : UI_COPY.initialAccuracy;
}

function fmtTarget(targetAccuracy) {
  return targetAccuracy != null ? `${targetAccuracy}m` : UI_COPY.initialTarget;
}

function setLightboxBusy(isBusy) {
  const lightbox = dom.lightbox();
  if (!lightbox) return;
  lightbox.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function openLightbox() {
  const lightbox = dom.lightbox();
  if (!lightbox) return;
  lightbox.classList.remove("is-hidden");
}

function closeLightbox() {
  const lightbox = dom.lightbox();
  if (!lightbox) return;
  lightbox.classList.add("is-hidden");
}

function startSpinner() {
  const spinner = dom.spinner();
  if (!spinner) return;
  spinner.classList.add("spinning");
}

function stopSpinner() {
  const spinner = dom.spinner();
  if (!spinner) return;
  spinner.classList.remove("spinning");
}

function hidePrimaryButton() {
  const btn = dom.btnPrimary();
  if (!btn) return;
  btn.classList.add("is-hidden");
}

function showPrimaryButton(texto) {
  const btn = dom.btnPrimary();
  if (!btn) return;
  setText(btn, texto);
  btn.classList.remove("is-hidden");
}

function resetLightboxVisual() {
  stopSpinner();
  setLightboxBusy(false);

  setText(dom.title(), UI_COPY.initialTitle);
  setText(dom.subtitle(), UI_COPY.initialSubtitle);
  setText(dom.hint(), UI_COPY.initialHint);
  setText(dom.accuracy(), UI_COPY.initialAccuracy);
  setText(dom.target(), UI_COPY.initialTarget);
  setText(dom.btnPrimary(), UI_COPY.fallbackButton);

  hidePrimaryButton();
}

function renderCurrentState() {
  switch (runtime.currentState) {
    case FLOW_STATE.IDLE:
      resetLightboxVisual();
      closeLightbox();
      return;

    case FLOW_STATE.REQUESTING_LOCATION:
      resetLightboxVisual();
      setLightboxBusy(true);
      openLightbox();
      return;

    case FLOW_STATE.IMPROVING_LOCATION:
      resetLightboxVisual();
      setLightboxBusy(true);
      openLightbox();
      startSpinner();
      setText(dom.title(), UI_COPY.improvingTitle);
      setText(dom.subtitle(), UI_COPY.improvingSubtitle);
      setText(dom.hint(), UI_COPY.improvingHint);
      setText(dom.accuracy(), fmtAcc(runtime.bestAcc));
      setText(dom.target(), fmtTarget(runtime.targetAccuracy));
      return;

    case FLOW_STATE.READY_TO_SEND:
      resetLightboxVisual();
      openLightbox();
      setText(dom.title(), UI_COPY.readyTitle);
      setText(dom.subtitle(), "");
      setText(dom.hint(), "");
      setText(dom.accuracy(), fmtAcc(runtime.bestAcc));
      setText(dom.target(), runtime.coordsConfirmed ? fmtTarget(runtime.targetAccuracy) : UI_COPY.initialTarget);
      showPrimaryButton(UI_COPY.readyButton);
      return;
  }
}

function setFlowState(nextState) {
  runtime.currentState = nextState;
  renderCurrentState();
}

// ======================
// LIFECYCLE / RESET
// ======================
function clearScheduledWork() {
  if (runtime.waitCoordsTimeoutId) {
    clearTimeout(runtime.waitCoordsTimeoutId);
    runtime.waitCoordsTimeoutId = null;
  }

  if (runtime.manualReleaseTimeoutId) {
    clearTimeout(runtime.manualReleaseTimeoutId);
    runtime.manualReleaseTimeoutId = null;
  }

  if (runtime.maxAttemptTimeoutId) {
    clearTimeout(runtime.maxAttemptTimeoutId);
    runtime.maxAttemptTimeoutId = null;
  }

  if (runtime.increaseTargetIntervalId) {
    clearInterval(runtime.increaseTargetIntervalId);
    runtime.increaseTargetIntervalId = null;
  }

  if (runtime.improvementTickIntervalId) {
    clearInterval(runtime.improvementTickIntervalId);
    runtime.improvementTickIntervalId = null;
  }

  if (runtime.retryWatchTimeoutId) {
    clearTimeout(runtime.retryWatchTimeoutId);
    runtime.retryWatchTimeoutId = null;
  }
}

function stopGeolocationWatch() {
  if (runtime.watchId != null) {
    navigator.geolocation.clearWatch(runtime.watchId);
    runtime.watchId = null;
  }
}

function resetRuntimeState() {
  runtime = createRuntimeState();
}

function interruptFlow() {
  stopGeolocationWatch();
  clearScheduledWork();
  resetRuntimeState();
  setFlowState(FLOW_STATE.IDLE);
}

// ======================
// GEOLOCATION FLOW
// ======================
function aplicarSeMelhor(lat, lon, acc) {
  if (!coordenadasValidas(lat, lon)) return false;
  if (acc == null || !Number.isFinite(Number(acc))) return false;

  if (runtime.bestAcc == null || acc < runtime.bestAcc) {
    runtime.bestLat = lat;
    runtime.bestLon = lon;
    runtime.bestAcc = acc;
    return true;
  }

  return false;
}

function prepareReadyToSend(urlFinal) {
  stopGeolocationWatch();
  clearScheduledWork();

  runtime.pendingWhatsAppUrl = urlFinal;
  setFlowState(FLOW_STATE.READY_TO_SEND);
  abrirWhatsApp(urlFinal);
}

function iniciarTentativaAposConfirmacao() {
  runtime.manualReleaseTimeoutId = setTimeout(() => {
    if (runtime.currentState !== FLOW_STATE.IMPROVING_LOCATION) return;

    setText(dom.hint(), UI_COPY.manualHint);
    showPrimaryButton(UI_COPY.manualButton);
  }, LIBERAR_MANUAL_MS);

  runtime.increaseTargetIntervalId = setInterval(() => {
    if (runtime.currentState !== FLOW_STATE.IMPROVING_LOCATION) return;

    runtime.targetAccuracy += AUMENTO_META_M;
    setText(dom.target(), fmtTarget(runtime.targetAccuracy));
  }, AUMENTO_META_MS);

  runtime.improvementTickIntervalId = setInterval(() => {
    if (runtime.currentState !== FLOW_STATE.IMPROVING_LOCATION) return;

    aplicarSeMelhor(runtime.lastLat, runtime.lastLon, runtime.lastAcc);
    setText(dom.accuracy(), fmtAcc(runtime.bestAcc));

    if (
      runtime.bestAcc != null &&
      runtime.targetAccuracy != null &&
      runtime.bestAcc <= runtime.targetAccuracy
    ) {
      prepareReadyToSend(montarUrlComMelhorLeituraOuFallback());
    }
  }, TICK_MELHORIA_MS);

  runtime.maxAttemptTimeoutId = setTimeout(() => {
    if (runtime.currentState !== FLOW_STATE.IMPROVING_LOCATION) return;
    prepareReadyToSend(montarUrlComMelhorLeituraOuFallback());
  }, TENTATIVA_MAX_MS);
}

function confirmarLocalizacaoSePossivel() {
  if (runtime.coordsConfirmed) return;

  if (coordenadasValidas(runtime.lastLat, runtime.lastLon) && runtime.lastAcc != null) {
    runtime.coordsConfirmed = true;

    if (runtime.waitCoordsTimeoutId) {
      clearTimeout(runtime.waitCoordsTimeoutId);
      runtime.waitCoordsTimeoutId = null;
    }

    runtime.targetAccuracy = META_INICIAL_M;
    runtime.bestLat = runtime.lastLat;
    runtime.bestLon = runtime.lastLon;
    runtime.bestAcc = runtime.lastAcc;

    setFlowState(FLOW_STATE.IMPROVING_LOCATION);
    iniciarTentativaAposConfirmacao();
  }
}

function mensagemErroLocalizacao(err) {
  if (err?.code === 1) return "Permissão de localização negada.";
  if (err?.code === 2) return "Localização indisponível. Ative o GPS/localização.";
  if (err?.code === 3) return "Tempo esgotado ao tentar obter a localização.";
  return "Falha ao obter a localização.";
}

function agendarRetryWatch() {
  if (runtime.retryWatchTimeoutId) return;

  runtime.retryWatchTimeoutId = setTimeout(() => {
    runtime.retryWatchTimeoutId = null;

    if (runtime.currentState === FLOW_STATE.REQUESTING_LOCATION) {
      startGeolocationWatch();
    }
  }, RETRY_WATCH_MS);
}

function startGeolocationWatch() {
  stopGeolocationWatch();

  runtime.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      runtime.lastLat = pos.coords.latitude;
      runtime.lastLon = pos.coords.longitude;
      runtime.lastAcc = pos.coords.accuracy;

      if (runtime.retryWatchTimeoutId) {
        clearTimeout(runtime.retryWatchTimeoutId);
        runtime.retryWatchTimeoutId = null;
      }

      confirmarLocalizacaoSePossivel();
    },
    (err) => {
      if (
        runtime.currentState !== FLOW_STATE.REQUESTING_LOCATION &&
        runtime.currentState !== FLOW_STATE.IMPROVING_LOCATION
      ) {
        return;
      }

      setText(dom.hint(), mensagemErroLocalizacao(err));

      if (runtime.currentState === FLOW_STATE.REQUESTING_LOCATION && err?.code !== 1) {
        agendarRetryWatch();
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
    }
  );
}

function startMessageFlow(tipo) {
  interruptFlow();

  runtime.selectedType = tipo || TIPO_PADRAO_EMERGENCIA;

  if (!navigator.geolocation) {
    prepareReadyToSend(montarUrlSemLocalizacao());
    return;
  }

  setFlowState(FLOW_STATE.REQUESTING_LOCATION);

  runtime.waitCoordsTimeoutId = setTimeout(() => {
    if (runtime.currentState !== FLOW_STATE.REQUESTING_LOCATION) return;
    showPrimaryButton(UI_COPY.fallbackButton);
  }, ESPERA_COORDS_MS);

  startGeolocationWatch();
}

// ======================
// EVENTS
// ======================
function onTypeButtonClick(event) {
  event.preventDefault();

  const tipo = event.currentTarget?.dataset.emergencyType;
  if (!tipo) return;

  startMessageFlow(tipo);
}

function onPrimaryActionClick() {
  if (runtime.currentState === FLOW_STATE.REQUESTING_LOCATION) {
    prepareReadyToSend(montarUrlSemLocalizacao());
    return;
  }

  if (runtime.currentState === FLOW_STATE.IMPROVING_LOCATION) {
    prepareReadyToSend(montarUrlComMelhorLeituraOuFallback());
    return;
  }

  if (runtime.currentState === FLOW_STATE.READY_TO_SEND && runtime.pendingWhatsAppUrl) {
    const url = runtime.pendingWhatsAppUrl;
    interruptFlow();
    abrirWhatsApp(url);
  }
}

function onCloseLightboxClick() {
  interruptFlow();
}

function bindTypeButtons() {
  dom.typeButtons().forEach((btn) => {
    btn.addEventListener("click", onTypeButtonClick);
  });
}

// ======================
// INIT
// ======================
export function init() {
  setFlowState(FLOW_STATE.IDLE);

  bindTypeButtons();

  const btnPrimary = dom.btnPrimary();
  if (btnPrimary) {
    btnPrimary.addEventListener("click", onPrimaryActionClick);
  }

  const btnClose = dom.btnClose();
  if (btnClose) {
    btnClose.addEventListener("click", onCloseLightboxClick);
  }

  window.addEventListener("pagehide", interruptFlow);
}
