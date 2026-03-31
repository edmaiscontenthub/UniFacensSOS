// ======================
// CONFIG
// ======================
const NUMERO_DESTINO_PADRAO = "5515991966412"; // Quando tipo não tem número ou é dia desabilitado, usa esse número genérico
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

const META_INICIAL_M = 10; // meta começa em 10m
const AUMENTO_META_M = 5; // meta aumenta 5m
const AUMENTO_META_MS = 2500; // meta aumenta a cada 2,5s

const ESPERA_COORDS_MS = 3000;     // botão "Enviar sem localização" após 3s
const LIBERAR_MANUAL_MS = 3000;    // após confirmar coords, libera "Enviar sem precisão" após 3s
const TENTATIVA_MAX_MS = 10000;    // após confirmar coords, tenta melhorar por no máximo 10s
const TICK_MELHORIA_MS = 500;      // ciclo de atualização/checagem de melhoria a cada 500ms

// Retry do watch quando GPS estava off e depois liga (PC costuma precisar)
const RETRY_WATCH_MS = 2000;

// ======================
// STATE
// ======================
let watchID = null;

let tipoEmergencia = "EMERGÊNCIA";
let enviouMensagem = false;

let coordenadaConfirmada = false;

let lastLat = null;
let lastLon = null;
let lastAcc = null;

let bestLat = null;
let bestLon = null;
let bestAcc = null;

let metaPrecisao = null;

// timers/intervalos
let tEsperaCoords = null;     // 3s
let tLiberarManual = null;    // 3s
let tMaxTentativa = null;     // 10s
let iAumentarMeta = null;     // 2s
let iTickMelhoria = null;     // 500ms

// retry do watch
let tRetryWatch = null;

// WhatsApp URL final (para botão fallback)
let waUrlPendente = null;
let modoAbrirWhatsApp = false;

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
  btnForcar: () => document.getElementById("btnForcar"),

  spinner: () =>
    document.getElementById("lbSpinner") ||
    document.querySelector(".lb__spinner"),
};

// ======================
// UI helpers
// ======================
function setText(el, value) {
  if (el && value != null) el.textContent = value;
}

function openLightbox() {
  const lb = dom.lightbox();
  if (!lb) return;
  lb.classList.remove("is-hidden");
  lb.setAttribute("aria-busy", "true");
}

function closeLightbox() {
  const lb = dom.lightbox();
  if (!lb) return;
  lb.classList.add("is-hidden");
  lb.setAttribute("aria-busy", "false");
}

function hideBtn() {
  const btn = dom.btnForcar();
  if (!btn) return;
  btn.classList.add("is-hidden");
}

function showBtn() {
  const btn = dom.btnForcar();
  if (!btn) return;
  btn.classList.remove("is-hidden");
}

function setBtnText(texto) {
  const btn = dom.btnForcar();
  if (!btn || texto == null) return;
  btn.textContent = texto;
}

function fmtAcc(acc) {
  return (acc != null) ? `${Math.round(acc)}m` : "—";
}

function iniciarSpinner() {
  const sp = dom.spinner();
  if (!sp) return;
  sp.classList.add("spinning");
}

// ======================
// Coordenadas / Link (GitHub Pages ok)
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

// ======================
// WhatsApp (auto + fallback botão)
// ======================
function montarUrlWhatsApp(lat, lon, accuracy) {
  const numeroDestino = obterNumeroDestinoPorTipo(tipoEmergencia);
  const link = textoLinkMapaOuNaoDisponivel(lat, lon);
  const prec = textoPrecisaoOuNaoDisponivel(lat, lon, accuracy);

  const msg = [
    "PEDIDO DE AJUDA",
    "",
    `Tipo: ${tipoEmergencia}`,
    "",
    `Precisão: ${prec}`,
    "",
    `Localização: ${link}`,
  ].join("\n");

  return `https://wa.me/${numeroDestino}?text=${encodeURIComponent(msg)}`;
}

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

function abrirWhatsApp(url) {
  // mantém estratégia anterior: tenta nova aba; se bloquear, mesma aba
  const popup = window.open(url, "_blank");
  if (!popup) window.location.href = url;
}

/**
 * Atualiza UI para "Pronto!" e botão "Abrir WhatsApp"
 * e tenta abrir automaticamente.
 */
function tentarEnviarParaWhatsApp(urlFinal) {
  if (enviouMensagem) return;
  enviouMensagem = true;

  waUrlPendente = urlFinal;
  modoAbrirWhatsApp = true;

  // Atualiza lightbox (como você pediu)
  openLightbox();
  setText(dom.title(), "Pronto!");
  setText(dom.subtitle(), "");
  setText(dom.hint(), "");

  setBtnText("Abrir WhatsApp");
  showBtn();
  // ✅ tenta abrir automaticamente (e o botão fica como fallback se bloquear)
  abrirWhatsApp(urlFinal);
}

// ======================
// Cleanup
// ======================
function clearAllTimers() {
  if (tEsperaCoords) { clearTimeout(tEsperaCoords); tEsperaCoords = null; }
  if (tLiberarManual) { clearTimeout(tLiberarManual); tLiberarManual = null; }
  if (tMaxTentativa) { clearTimeout(tMaxTentativa); tMaxTentativa = null; }
  if (iAumentarMeta) { clearInterval(iAumentarMeta); iAumentarMeta = null; }
  if (iTickMelhoria) { clearInterval(iTickMelhoria); iTickMelhoria = null; }
  if (tRetryWatch) { clearTimeout(tRetryWatch); tRetryWatch = null; }
}

function stopWatch() {
  if (watchID) {
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
  }
}

function resetState() {
  enviouMensagem = false;
  coordenadaConfirmada = false;

  lastLat = null; lastLon = null; lastAcc = null;
  bestLat = null; bestLon = null; bestAcc = null;

  metaPrecisao = null;

  waUrlPendente = null;
  modoAbrirWhatsApp = false;
}

function stopAll() {
  stopWatch();
  clearAllTimers();
}

// ======================
// Fluxo: confirmação e melhoria
// ======================
function aplicarSeMelhor(lat, lon, acc) {
  if (!coordenadasValidas(lat, lon)) return false;
  if (acc == null || !Number.isFinite(Number(acc))) return false;

  if (bestAcc == null || acc < bestAcc) {
    bestLat = lat;
    bestLon = lon;
    bestAcc = acc;
    return true;
  }
  return false;
}

function iniciarTentativaAposConfirmacao() {
  // após 3s: libera manual e muda texto do botão
  tLiberarManual = setTimeout(() => {
    if (enviouMensagem) return;
    setText(dom.hint(), "Se a meta não for atingida, você ainda pode enviar manualmente.");
    setBtnText("Enviar sem precisão");
    showBtn();
  }, LIBERAR_MANUAL_MS);

  // aumenta meta a cada 2,5s
  iAumentarMeta = setInterval(() => {
    if (enviouMensagem) return;
    metaPrecisao += AUMENTO_META_M;
    setText(dom.target(), `${metaPrecisao}m`);
  }, AUMENTO_META_MS);

  // loop de melhoria a cada 500ms (sem piorar)
  iTickMelhoria = setInterval(() => {
    if (enviouMensagem) return;

    aplicarSeMelhor(lastLat, lastLon, lastAcc);
    setText(dom.accuracy(), fmtAcc(bestAcc));

    // meta atingida -> tenta enviar automaticamente
    if (bestAcc != null && metaPrecisao != null && bestAcc <= metaPrecisao) {
      stopAll();
      const urlFinal = montarUrlWhatsApp(bestLat, bestLon, bestAcc);
      tentarEnviarParaWhatsApp(urlFinal);
    }
  }, TICK_MELHORIA_MS);

  // limite máximo de 10s para tentar melhorar
  tMaxTentativa = setTimeout(() => {
    if (enviouMensagem) return;

    stopAll();

    if (coordenadasValidas(bestLat, bestLon)) {
      const urlFinal = montarUrlWhatsApp(bestLat, bestLon, bestAcc);
      tentarEnviarParaWhatsApp(urlFinal);
    } else {
      const urlFinal = montarUrlWhatsApp(null, null, null);
      tentarEnviarParaWhatsApp(urlFinal);
    }
  }, TENTATIVA_MAX_MS);
}

function confirmarLocalizacaoSePossivel() {
  if (coordenadaConfirmada) return;

  if (coordenadasValidas(lastLat, lastLon) && lastAcc != null) {
    coordenadaConfirmada = true;

    // cancela janela dos 3s (não vai mais mostrar "Enviar sem localização")
    if (tEsperaCoords) { clearTimeout(tEsperaCoords); tEsperaCoords = null; }

    // esconde botão ao confirmar coords
    hideBtn();

    // inicia spinner girando ao confirmar coords
    iniciarSpinner();

    // define meta e primeira melhor leitura
    metaPrecisao = META_INICIAL_M;
    bestLat = lastLat;
    bestLon = lastLon;
    bestAcc = lastAcc;

    // começa a mostrar valores
    setText(dom.accuracy(), fmtAcc(bestAcc));
    setText(dom.target(), `${metaPrecisao}m`);

    // muda textos do estado "confirmou"
    setText(dom.title(), "Aguarde, buscando localização…");
    setText(dom.subtitle(), "Melhorando a precisão do GPS.");
    setText(dom.hint(), "Isso pode levar alguns segundos.");

    iniciarTentativaAposConfirmacao();
  }
}

// ======================
// watchPosition com retry (para ligar GPS sem refresh)
// ======================
function startWatch() {
  // evita múltiplos watchers
  stopWatch();

  watchID = navigator.geolocation.watchPosition(
    (pos) => {
      lastLat = pos.coords.latitude;
      lastLon = pos.coords.longitude;
      lastAcc = pos.coords.accuracy;

      // se estava em retry, cancela
      if (tRetryWatch) { clearTimeout(tRetryWatch); tRetryWatch = null; }

      confirmarLocalizacaoSePossivel();
    },
    (err) => {
      // Não mostra botão imediatamente; botão segue a regra dos 3s.

      const motivo =
        err?.code === 1 ? "Permissão de localização negada." :
        err?.code === 2 ? "Localização indisponível. Ative o GPS/localização." :
        err?.code === 3 ? "Tempo esgotado ao tentar obter a localização." :
        "Falha ao obter a localização.";

      setText(dom.hint(), motivo);
      // ✅ Se não é permissão negada (code 1), faz retry automático para pegar quando o usuário ligar o GPS
      if (!coordenadaConfirmada && !enviouMensagem && err?.code !== 1) {
        if (!tRetryWatch) {
          tRetryWatch = setTimeout(() => {
            tRetryWatch = null;
            if (!coordenadaConfirmada && !enviouMensagem) startWatch();
          }, RETRY_WATCH_MS);
        }
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    }
  );
}

// ======================
// Entrada principal
// ======================
function iniciarLocalizacao() {
  if (!navigator.geolocation) {
    const urlFinal = montarUrlWhatsApp(null, null, null);
    tentarEnviarParaWhatsApp(urlFinal);
    return;
  }

  stopAll();
  resetState();

  openLightbox();

  // valores dinâmicos
  setText(dom.accuracy(), "—");
  setText(dom.target(), "—");

  // botão começa oculto (texto já está no HTML)
  hideBtn();

  // SEMPRE após 3s mostra "Enviar sem localização" se não confirmar coords
  tEsperaCoords = setTimeout(() => {
    if (enviouMensagem) return;
    if (!coordenadaConfirmada) showBtn();
  }, ESPERA_COORDS_MS);

  // inicia watch (com retry automático)
  startWatch();
}

function definirTipo(tipo) {
  tipoEmergencia = tipo;
}

// ======================
// Botão: 3 modos
// - "Abrir WhatsApp" (fallback/confirm)
/// - "Enviar sem localização" (não confirmado)
/// - "Enviar sem precisão" (confirmado, mas usuário quer enviar já)
// ======================
function onBtnClick() {
  // Modo "Abrir WhatsApp"
  if (modoAbrirWhatsApp && waUrlPendente) {
    closeLightbox();
    abrirWhatsApp(waUrlPendente);
    return;
  }

  // Se ainda não confirmou: enviar sem localização -> tenta abrir automaticamente
  if (!coordenadaConfirmada) {
    stopAll();
    const urlFinal = montarUrlWhatsApp(null, null, null);
    tentarEnviarParaWhatsApp(urlFinal);
    return;
  }

  // Se já confirmou: enviar melhor leitura (sem exigir meta) -> tenta abrir automaticamente
  stopAll();

  if (coordenadasValidas(bestLat, bestLon)) {
    const urlFinal = montarUrlWhatsApp(bestLat, bestLon, bestAcc);
    tentarEnviarParaWhatsApp(urlFinal);
  } else {
    const urlFinal = montarUrlWhatsApp(null, null, null);
    tentarEnviarParaWhatsApp(urlFinal);
  }
}

// ======================
// INIT
// ======================
export function init() {
  const btn = dom.btnForcar();
  if (btn) {
    btn.classList.add("is-hidden");
    btn.addEventListener("click", onBtnClick);
  }

  window.definirTipo = definirTipo;
  window.iniciarLocalizacao = iniciarLocalizacao;
}