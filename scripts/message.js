/**
 * UniFacens SOS — message.js (versão limpa)
 * - Configurações foram para HTML/CSS
 * - JS apenas:
 *   1) liga/desliga lightbox
 *   2) atualiza textos (precisão/meta/status)
 *   3) controla timers e envio
 * - Sem "probe" e sem SMS
 */

// ======================
// CONFIG
// ======================
const NUMERO_DESTINO = "5515981144802";

const META_INICIAL_M = 15;
const TEMPO_JANELA_INICIAL_MS = 5000;
const PASSO_RELAXAMENTO_M = 10;
const PASSO_RELAXAMENTO_MS = 2000;
const TEMPO_MAXIMO_MS = 20000;

// ======================
// STATE
// ======================
let watchID = null;

let tipoEmergencia = "EMERGÊNCIA";
let ultimoLat = null;
let ultimoLon = null;
let ultimaPrecisao = null;

let metaPrecisao = META_INICIAL_M;
let botaoLiberado = false;
let enviouMensagem = false;

let escalonadorID = null;
let timeoutInicialID = null;
let timeoutMaxID = null;

// ======================
// DOM (cache)
// ======================
const dom = {
  lightbox: () => document.getElementById("lightbox"),
  title: () => document.getElementById("lbTitle"),
  subtitle: () => document.getElementById("lbSubtitle"),
  accuracy: () => document.getElementById("lbAccuracy"),
  target: () => document.getElementById("lbTarget"),
  hint: () => document.getElementById("lbHint"),
  btnForcar: () => document.getElementById("btnForcar"),
};

// ======================
// UI helpers
// ======================
function fmtM(value) {
  return (value != null) ? `${Math.round(value)}m` : "—";
}

function abrirLightbox() {
  const lb = dom.lightbox();
  if (!lb) return;
  lb.classList.remove("is-hidden");
  lb.setAttribute("aria-busy", "true");
}

function fecharLightbox() {
  const lb = dom.lightbox();
  if (!lb) return;
  lb.classList.add("is-hidden");
  lb.setAttribute("aria-busy", "false");
}

function setTexto({ title, subtitle, accuracy, target, hint }) {
  const t = dom.title(); if (t && title != null) t.textContent = title;
  const s = dom.subtitle(); if (s && subtitle != null) s.textContent = subtitle;
  const a = dom.accuracy(); if (a && accuracy != null) a.textContent = accuracy;
  const m = dom.target(); if (m && target != null) m.textContent = target;
  const h = dom.hint(); if (h && hint != null) h.textContent = hint;
}

function mostrarBtnForcar(mostrar) {
  const btn = dom.btnForcar();
  if (!btn) return;
  btn.classList.toggle("is-hidden", !mostrar);
}

// ======================
// timers / reset
// ======================
function limparTimers() {
  if (timeoutInicialID) { clearTimeout(timeoutInicialID); timeoutInicialID = null; }
  if (escalonadorID) { clearInterval(escalonadorID); escalonadorID = null; }
  if (timeoutMaxID) { clearTimeout(timeoutMaxID); timeoutMaxID = null; }
}

function resetarEstado() {
  ultimoLat = null;
  ultimoLon = null;
  ultimaPrecisao = null;

  metaPrecisao = META_INICIAL_M;
  botaoLiberado = false;
  enviouMensagem = false;
}

function pararLocalizacao() {
  if (watchID) {
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
  }
  limparTimers();
  fecharLightbox();
}

// ======================
// link do mapa (GitHub Pages ok)
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

function obterTextoLinkMapa(lat, lon) {
  return coordenadasValidas(lat, lon)
    ? gerarLinkMapa(Number(lat), Number(lon))
    : "Não disponível";
}

// ======================
// WhatsApp
// ======================
function enviarMensagem(lat, lon, accuracy, motivo = null) {
  if (enviouMensagem) return;
  enviouMensagem = true;

  const link = obterTextoLinkMapa(lat, lon);
  const prec = (accuracy != null) ? `${Math.round(accuracy)} metros` : "Não disponível";

  const statusLocalizacao = (link !== "Não disponível")
    ? "Localização obtida."
    : (motivo ? `Localização indisponível: ${motivo}` : "Localização indisponível.");

  const msg = [
    "PEDIDO DE AJUDA",
    "",
    `Tipo: ${tipoEmergencia}`,
    "",
    `Status: ${statusLocalizacao}`,
    "",
    `Precisão: ${prec}`,
    "",
    `Localização: ${link}`,
  ].join("\n");

  const url = `https://wa.me/${NUMERO_DESTINO}?text=${encodeURIComponent(msg)}`;

  const popup = window.open(url, "_blank");
  if (!popup) window.location.href = url;
}

// ======================
// fluxo principal
// ======================
function iniciarTimeoutMaximo() {
  timeoutMaxID = setTimeout(() => {
    if (enviouMensagem) return;

    pararLocalizacao();

    if (coordenadasValidas(ultimoLat, ultimoLon)) {
      enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao, "Tempo máximo atingido.");
    } else {
      enviarMensagem(null, null, null, "Tempo máximo atingido e sem coordenadas.");
    }
  }, TEMPO_MAXIMO_MS);
}

function liberarBotaoSemPrecisao() {
  if (botaoLiberado) return;
  botaoLiberado = true;

  mostrarBtnForcar(true);
  setTexto({
    hint: "Você já pode enviar sem meta de precisão."
  });
}

function iniciarEscalonamentoMeta() {
  timeoutInicialID = setTimeout(() => {
    liberarBotaoSemPrecisao();

    escalonadorID = setInterval(() => {
      metaPrecisao += PASSO_RELAXAMENTO_M;

      setTexto({
        title: "Aprimorando precisão…",
        subtitle: "Tentando obter uma leitura mais precisa.",
        accuracy: fmtM(ultimaPrecisao),
        target: `${metaPrecisao}m`,
        hint: "Se a meta não for atingida, você ainda pode enviar manualmente."
      });

      if (coordenadasValidas(ultimoLat, ultimoLon) && ultimaPrecisao != null && ultimaPrecisao <= metaPrecisao) {
        setTexto({
          title: "Meta atingida ✅",
          subtitle: "Enviando alerta…"
        });

        pararLocalizacao();
        enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
      }
    }, PASSO_RELAXAMENTO_MS);
  }, TEMPO_JANELA_INICIAL_MS);
}

function iniciarLocalizacao() {
  if (!navigator.geolocation) {
    enviarMensagem(null, null, null, "Geolocalização não suportada neste dispositivo.");
    return;
  }

  pararLocalizacao(); // encerra tentativa anterior (se houver)
  resetarEstado();

  abrirLightbox();
  mostrarBtnForcar(false);

  // Estado inicial no HTML (JS só confirma valores dinâmicos)
  setTexto({
    title: "Buscando localização…",
    subtitle: "Ative o GPS e permita o acesso, se solicitado.",
    accuracy: "—",
    target: `${metaPrecisao}m`,
    hint: "Isso pode levar alguns segundos."
  });

  iniciarEscalonamentoMeta();
  iniciarTimeoutMaximo();

  watchID = navigator.geolocation.watchPosition(
    (pos) => {
      ultimoLat = pos.coords.latitude;
      ultimoLon = pos.coords.longitude;
      ultimaPrecisao = pos.coords.accuracy;

      const temCoords = coordenadasValidas(ultimoLat, ultimoLon);

      if (!temCoords) {
        setTexto({
          title: "Buscando localização…",
          subtitle: "Obtendo coordenadas do dispositivo.",
          accuracy: "—",
          target: `${metaPrecisao}m`,
          hint: "Se estiver em ambiente fechado, a precisão pode ser limitada."
        });
      } else {
        setTexto({
          title: "Aprimorando precisão…",
          subtitle: botaoLiberado ? "Você já pode enviar manualmente." : "Aguardando uma leitura mais precisa.",
          accuracy: fmtM(ultimaPrecisao),
          target: `${metaPrecisao}m`,
          hint: botaoLiberado ? "Se necessário, toque em “Enviar agora (sem meta)”." : "Isso pode levar alguns segundos."
        });
      }

      if (ultimaPrecisao != null && ultimaPrecisao <= metaPrecisao) {
        setTexto({
          title: "Meta atingida ✅",
          subtitle: "Enviando alerta…",
          accuracy: fmtM(ultimaPrecisao),
          target: `${metaPrecisao}m`,
          hint: ""
        });

        pararLocalizacao();
        enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
      }
    },
    (err) => {
      pararLocalizacao();

      const motivo =
        err?.code === 1 ? "Permissão de localização negada." :
        err?.code === 2 ? "Não foi possível obter o GPS (sinal fraco/indisponível)." :
        err?.code === 3 ? "Tempo esgotado ao tentar obter a localização." :
        "Falha ao obter a localização.";

      // Mostra o lightbox novamente apenas para feedback rápido (opcional)
      abrirLightbox();
      mostrarBtnForcar(false);
      setTexto({
        title: "Localização indisponível",
        subtitle: motivo,
        accuracy: "—",
        target: `${metaPrecisao}m`,
        hint: "Enviando alerta sem coordenadas…"
      });

      enviarMensagem(null, null, null, motivo);
      // não precisa fechar imediatamente; se quiser, feche após 800ms:
      setTimeout(() => fecharLightbox(), 800);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    }
  );
}

function enviarSemPrecisao() {
  pararLocalizacao();

  if (coordenadasValidas(ultimoLat, ultimoLon)) {
    enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao, "Envio manual sem meta de precisão.");
  } else {
    enviarMensagem(null, null, null, "Envio manual sem coordenadas.");
  }
}

function definirTipo(tipo) {
  tipoEmergencia = tipo;
}

// ======================
// INIT
// ======================
export function init() {
  // botão do HTML chama via listener (evita inline onclick)
  const btn = dom.btnForcar();
  if (btn) btn.addEventListener("click", enviarSemPrecisao);

  // mantém compatibilidade com onclick existentes no HTML
  window.definirTipo = definirTipo;
  window.iniciarLocalizacao = iniciarLocalizacao;
  window.enviarSemPrecisao = enviarSemPrecisao;
}
