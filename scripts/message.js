/**
 * UniFacens SOS — message.js
 * Fluxo:
 * 1) Usuário clica no botão -> iniciaLocalizacao()
 * 2) watchPosition tenta obter coordenadas e melhorar precisão
 * 3) Meta inicial: 15m (por 5s). Após 5s: libera botão e relaxa meta (+10m a cada 2s)
 * 4) Se atingir a meta, envia automaticamente pelo WhatsApp
 * 5) Tempo máximo: 20s -> envia com coordenadas (se existirem) ou sem coordenadas
 *
 * Observações:
 * - Removido: validação "probe" (getCurrentPosition antes do watch)
 * - Removido: envio por SMS
 * - Mantido: link de mapa compatível com GitHub Pages (project pages)
 */

// ======================
// CONFIGURAÇÕES
// ======================
const NUMERO_DESTINO = "5515981144802";

// Ajuste de tempos/metas
const META_INICIAL_M = 15;
const TEMPO_JANELA_INICIAL_MS = 5000;
const PASSO_RELAXAMENTO_M = 10;
const PASSO_RELAXAMENTO_MS = 2000;
const TEMPO_MAXIMO_MS = 20000;

// ======================
// ESTADO (RUNTIME)
// ======================
let watchID = null;

let tipoEmergencia = "EMERGÊNCIA";
let ultimoLat = null;
let ultimoLon = null;
let ultimaPrecisao = null;

let metaPrecisao = META_INICIAL_M;
let botaoLiberado = false;
let enviouMensagem = false;

// Timers (para limpar corretamente)
let escalonadorID = null;     // interval de relaxamento (a cada 2s)
let timeoutInicialID = null;  // timeout da janela inicial (5s)
let timeoutMaxID = null;      // timeout do tempo máximo (20s)

// ======================
// UI — LIGHTBOX
// ======================
function textoPrecisao(accuracy) {
  return (accuracy != null) ? `${Math.round(accuracy)}m` : "—";
}

function mostrarLightbox(html) {
  const box = document.getElementById("lightbox");
  box.style.display = "flex";
  document.querySelector("#lightbox p").innerHTML = html;

  // ao iniciar uma tentativa, o botão começa oculto
  const btn = document.getElementById("btnForcar");
  if (btn) btn.style.display = "none";
}

function atualizarLightbox({ titulo, linha1 = "", linha2 = "", rodape = "" }) {
  const linhas = [linha1, linha2].filter(Boolean).join("<br>");
  const extra = rodape ? `<br><br><small style="opacity:.85">${rodape}</small>` : "";
  document.querySelector("#lightbox p").innerHTML =
    `<b>${titulo}</b>${linhas ? "<br>" + linhas : ""}${extra}`;
}

function esconderLightbox() {
  const box = document.getElementById("lightbox");
  if (box) box.style.display = "none";
}

// ======================
// CONTROLE DE ESTADO
// ======================
function resetarEstado() {
  ultimoLat = null;
  ultimoLon = null;
  ultimaPrecisao = null;

  metaPrecisao = META_INICIAL_M;
  botaoLiberado = false;
  enviouMensagem = false;
}

function limparTimers() {
  if (timeoutInicialID) {
    clearTimeout(timeoutInicialID);
    timeoutInicialID = null;
  }
  if (escalonadorID) {
    clearInterval(escalonadorID);
    escalonadorID = null;
  }
  if (timeoutMaxID) {
    clearTimeout(timeoutMaxID);
    timeoutMaxID = null;
  }
}

function pararLocalizacao() {
  // para GPS
  if (watchID) {
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
  }

  // para timers
  limparTimers();

  // fecha UI
  esconderLightbox();
}

// ======================
// VALIDAÇÃO / LINK DO MAPA
// ======================
function coordenadasValidas(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lonNum < -180 || lonNum > 180) return false;

  // bloqueia coordenadas zeradas
  if (latNum === 0 && lonNum === 0) return false;

  return true;
}

/**
 * GitHub Pages (project pages) exige incluir /RepoName/ na base.
 * Ex.: https://usuario.github.io/UniFacensSOS/pages/map.html
 */
function obterRootDoSite() {
  const { origin, pathname } = window.location;
  // pega tudo antes de "/pages/" (ex.: "/UniFacensSOS" ou "")
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
// ENVIO — WHATSAPP
// ======================
function enviarMensagem(lat, lon, accuracy, motivo = null) {
  if (enviouMensagem) return;
  enviouMensagem = true;

  enviarViaWhatsApp(lat, lon, accuracy, motivo);
}

function enviarViaWhatsApp(lat, lon, accuracy, motivo) {
  const link = obterTextoLinkMapa(lat, lon);
  const prec = (accuracy != null) ? `${Math.round(accuracy)} metros` : "Não disponível";

  const statusLocalizacao = (link !== "Não disponível")
    ? "Localização obtida."
    : (motivo ? `Localização indisponível: ${motivo}` : "Localização indisponível.");

  // IMPORTANTÍSSIMO: sem indentação (WhatsApp preserva espaços)
  const msg = [
    "PEDIDO DE AJUDA",
    "",
    `Tipo: ${tipoEmergencia}`,
    "",
    `Status: ${statusLocalizacao}`,
    "",
    `Precisão: ${prec}`,
    "",
    `Localização: ${link}`
  ].join("\n");

  const url = `https://wa.me/${NUMERO_DESTINO}?text=${encodeURIComponent(msg)}`;

  // abre em nova aba quando permitido; fallback abre na mesma aba
  const popup = window.open(url, "_blank");
  if (!popup) window.location.href = url;
}

// ======================
// FLUXO DE LOCALIZAÇÃO
// ======================
function definirTipo(tipo) {
  tipoEmergencia = tipo;
}

/**
 * Inicia o cronômetro máximo (20s).
 * Se estourar, envia com coords se existirem, ou sem coords.
 */
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

/**
 * Escalonamento:
 * - 5s tentando a meta inicial
 * - após 5s: libera botão e relaxa meta (+10m a cada 2s)
 */
function iniciarEscalonamentoMeta() {
  limparTimers(); // garante que não acumule timers

  timeoutInicialID = setTimeout(() => {
    liberarBotaoSemPrecisao();

    escalonadorID = setInterval(() => {
      metaPrecisao += PASSO_RELAXAMENTO_M;

      atualizarLightbox({
        titulo: "Aprimorando precisão…",
        linha1: `Precisão atual: ${textoPrecisao(ultimaPrecisao)}`,
        linha2: `Meta ajustada: ${metaPrecisao}m`,
        rodape: "Se a meta não for atingida, você ainda pode enviar manualmente."
      });

      // se a meta ficou suficiente, dispara envio
      if (
        coordenadasValidas(ultimoLat, ultimoLon) &&
        ultimaPrecisao != null &&
        ultimaPrecisao <= metaPrecisao
      ) {
        atualizarLightbox({
          titulo: "Meta atingida ✅",
          linha1: `Precisão: ${textoPrecisao(ultimaPrecisao)}`,
          linha2: "Enviando alerta…"
        });

        pararLocalizacao();
        enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
      }
    }, PASSO_RELAXAMENTO_MS);
  }, TEMPO_JANELA_INICIAL_MS);
}

function liberarBotaoSemPrecisao() {
  if (botaoLiberado) return;
  botaoLiberado = true;

  const btn = document.getElementById("btnForcar");
  if (btn) btn.style.display = "block";

  atualizarLightbox({
    titulo: "Aprimorando precisão…",
    linha1: `Precisão atual: ${textoPrecisao(ultimaPrecisao)}`,
    linha2: `Meta: ${metaPrecisao}m`,
    rodape: "Você já pode enviar sem meta de precisão."
  });
}

function iniciarLocalizacao() {
  if (!navigator.geolocation) {
    enviarMensagem(null, null, null, "Geolocalização não suportada neste dispositivo.");
    return;
  }

  // encerra tentativa anterior (se houver) e reseta
  pararLocalizacao();
  resetarEstado();

  // feedback inicial
  mostrarLightbox("<b>Buscando localização…</b><br>Ative a localização e permita o acesso, se solicitado.");
  atualizarLightbox({
    titulo: "Buscando localização…",
    linha1: `Meta inicial: ${metaPrecisao}m`,
    rodape: "Isso pode levar alguns segundos."
  });

  // inicia timers do fluxo
  iniciarEscalonamentoMeta();
  iniciarTimeoutMaximo();

  // inicia rastreamento
  watchID = navigator.geolocation.watchPosition(
    (pos) => {
      ultimoLat = pos.coords.latitude;
      ultimoLon = pos.coords.longitude;
      ultimaPrecisao = pos.coords.accuracy;

      const temCoords = coordenadasValidas(ultimoLat, ultimoLon);

      if (!temCoords) {
        atualizarLightbox({
          titulo: "Buscando localização…",
          linha1: "Obtendo coordenadas do dispositivo.",
          linha2: `Meta: ${metaPrecisao}m`,
          rodape: "Se estiver em ambiente fechado, a precisão pode ser limitada."
        });
      } else {
        atualizarLightbox({
          titulo: "Aprimorando precisão…",
          linha1: `Precisão atual: ${textoPrecisao(ultimaPrecisao)}`,
          linha2: `Meta: ${metaPrecisao}m`,
          rodape: botaoLiberado ? "Você já pode enviar sem meta de precisão." : "Aguardando uma leitura mais precisa."
        });
      }

      // envio automático quando atingiu a meta
      if (ultimaPrecisao != null && ultimaPrecisao <= metaPrecisao) {
        atualizarLightbox({
          titulo: "Meta atingida ✅",
          linha1: `Precisão: ${textoPrecisao(ultimaPrecisao)}`,
          linha2: "Enviando alerta…"
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

      mostrarLightbox(`<b>Localização indisponível</b><br>${motivo}<br><br>Enviando alerta sem coordenadas…`);
      enviarMensagem(null, null, null, motivo);
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

// ======================
// INIT (exposto no window)
// ======================
export function init() {
  window.definirTipo = definirTipo;
  window.iniciarLocalizacao = iniciarLocalizacao;
  window.enviarSemPrecisao = enviarSemPrecisao;
}