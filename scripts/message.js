const NUMERO_DESTINO = "5515981144802";

let watchID = null;
let tipoEmergencia = "EMERGÊNCIA";
let ultimoLat = null;
let ultimoLon = null;
let ultimaPrecisao = null;
let timerBotao = null;
let timerSemGps = null;
let metaPrecisao = 15;          // meta inicial
let botaoLiberado = false;      // quando true, botão fica visível e não some mais
let escalonadorID = null;       // setInterval do escalonamento
let timeoutInicialID = null;    // setTimeout da janela inicial (5s)
let enviouMensagem = false;

// ===== controlar quando contadores podem começar =====
let iniciouContadores = false;
let timeoutMaxID = null;        // setTimeout do tempo máximo (20s)

// ===== Helpers de feedback do Lightbox =====
function textoPrecisao(accuracy) {
  return (accuracy != null) ? `${Math.round(accuracy)}m` : "—";
}

function atualizarLightbox({ titulo, linha1 = "", linha2 = "", rodape = "" }) {
  const linhas = [linha1, linha2].filter(Boolean).join("<br>");
  const extra = rodape ? `<br><br><small style="opacity:.85">${rodape}</small>` : "";
  document.querySelector("#lightbox p").innerHTML =
    `<b>${titulo}</b>${linhas ? "<br>" + linhas : ""}${extra}`;
}

function definirTipo(tipo){
  tipoEmergencia = tipo;
}

function mostrarLightbox(texto){
  document.getElementById("lightbox").style.display="flex";
  document.querySelector("#lightbox p").innerHTML = texto;
  document.getElementById("btnForcar").style.display = "none";
}

function esconderLightbox(){
  document.getElementById("lightbox").style.display="none";
  clearTimeout(timerBotao);
  clearTimeout(timerSemGps);
}

// ===== NOVO: probe curto para verificar se a localização está realmente disponível =====
function testarLocalizacaoDisponivel() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, motivo: "Geolocalização não suportada neste dispositivo." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy
        });
      },
      (err) => {
        const motivo =
          err?.code === 1 ? "Permissão de localização negada." :
          err?.code === 2 ? "Localização indisponível. Ative a localização (GPS) do celular." :
          err?.code === 3 ? "Sem resposta da localização. Verifique se o GPS está ativado." :
          "Falha ao obter a localização.";
        resolve({ ok: false, motivo });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 3000 // probe curto para detectar “GPS desligado/sem resposta”
      }
    );
  });
}

// ===== iniciar escalonamento + tempo máximo só quando houver sinal real do GPS =====
function iniciarContadoresSeNecessario() {
  if (iniciouContadores) return;
  iniciouContadores = true;

  iniciarEscalonamentoMeta();

  const TEMPO_MAX_MS = 20000;
  if (timeoutMaxID) clearTimeout(timeoutMaxID);
  timeoutMaxID = setTimeout(() => {
    if (enviouMensagem) return;

    pararLocalizacao();

    if (coordenadasValidas(ultimoLat, ultimoLon)) {
      enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao, "Tempo máximo atingido.");
    } else {
      enviarMensagem(null, null, null, "Tempo máximo atingido e sem coordenadas.");
    }
  }, TEMPO_MAX_MS);
}

function iniciarLocalizacao(){

  if(!navigator.geolocation){
    enviarMensagem(null,null,null, "Geolocalização não suportada neste dispositivo.");
    return;
  }

  // reset estado
  ultimoLat = null;
  ultimoLon = null;
  ultimaPrecisao = null;

  metaPrecisao = 15;
  botaoLiberado = false;
  enviouMensagem = false;

  // reset contadores/timers
  iniciouContadores = false;
  if (timeoutMaxID) { clearTimeout(timeoutMaxID); timeoutMaxID = null; }
  if (timeoutInicialID) { clearTimeout(timeoutInicialID); timeoutInicialID = null; }
  if (escalonadorID) { clearInterval(escalonadorID); escalonadorID = null; }
  if (watchID) { navigator.geolocation.clearWatch(watchID); watchID = null; }

  // ===== Feedback inicial =====
  mostrarLightbox("<b>Buscando localização…</b><br>Ative a localização e permita o acesso, se solicitado.");
  atualizarLightbox({
    titulo: "Buscando localização…",
    linha1: `Meta inicial: ${metaPrecisao}m`,
    rodape: "Confirmando se o GPS está ativo…"
  });

  // ===== Probe: só começa o processo se a localização estiver respondendo =====
  testarLocalizacaoDisponivel().then((res) => {
    if (enviouMensagem) return;

    if (!res.ok) {
      // Não inicia watch nem contadores. Não libera botão.
      atualizarLightbox({
        titulo: "Localização desativada",
        linha1: res.motivo,
        rodape: "Ative o GPS e toque novamente para tentar."
      });
      return;
    }

    // Se o probe deu ok, atualiza os últimos valores iniciais (ajuda UX)
    ultimoLat = res.lat;
    ultimoLon = res.lon;
    ultimaPrecisao = res.acc;

    atualizarLightbox({
      titulo: "Localização detectada ✅",
      linha1: `Precisão inicial: ${textoPrecisao(ultimaPrecisao)}`,
      linha2: `Meta: ${metaPrecisao}m`,
      rodape: "Aprimorando precisão…"
    });

    // Agora sim: inicia contadores + watch
    iniciarContadoresSeNecessario();

    watchID = navigator.geolocation.watchPosition(
      pos => {
        ultimoLat = pos.coords.latitude;
        ultimoLon = pos.coords.longitude;
        ultimaPrecisao = pos.coords.accuracy;

        // Feedback durante a localização
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

        // Envio automático ao atingir meta
        if (ultimaPrecisao !== null && ultimaPrecisao <= metaPrecisao) {
          atualizarLightbox({
            titulo: "Meta atingida ✅",
            linha1: `Precisão: ${textoPrecisao(ultimaPrecisao)}`,
            linha2: "Enviando alerta…"
          });

          pararLocalizacao();
          enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
        }
      },
      err => {
        pararLocalizacao();

        const motivo =
          err?.code === 1 ? "Permissão de localização negada." :
          err?.code === 2 ? "Localização indisponível. Ative a localização (GPS) do celular." :
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
  });
}

function iniciarEscalonamentoMeta() {
  if (timeoutInicialID) clearTimeout(timeoutInicialID);
  if (escalonadorID) clearInterval(escalonadorID);

  timeoutInicialID = setTimeout(() => {
    liberarBotaoSemPrecisao();

    escalonadorID = setInterval(() => {
      metaPrecisao += 10;

      atualizarLightbox({
        titulo: "Aprimorando precisão…",
        linha1: `Precisão atual: ${textoPrecisao(ultimaPrecisao)}`,
        linha2: `Meta ajustada: ${metaPrecisao}m`,
        rodape: "Se a meta não for atingida, você ainda pode enviar manualmente."
      });

      if (coordenadasValidas(ultimoLat, ultimoLon) && ultimaPrecisao != null && ultimaPrecisao <= metaPrecisao) {
        atualizarLightbox({
          titulo: "Meta atingida ✅",
          linha1: `Precisão: ${textoPrecisao(ultimaPrecisao)}`,
          linha2: "Enviando alerta…"
        });

        pararLocalizacao();
        enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
      }
    }, 2000);
  }, 5000);
}

function liberarBotaoSemPrecisao(){
  if(botaoLiberado) return;
  botaoLiberado = true;
  document.getElementById("btnForcar").style.display = "block";

  atualizarLightbox({
    titulo: "Aprimorando precisão…",
    linha1: `Precisão atual: ${textoPrecisao(ultimaPrecisao)}`,
    linha2: `Meta: ${metaPrecisao}m`,
    rodape: "Você já pode enviar sem meta de precisão."
  });
}

function enviarSemPrecisao(){
  pararLocalizacao();

  if(ultimoLat !== null && ultimoLon !== null){
    enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
  } else {
    enviarMensagem(null, null, null);
  }
}

function pararLocalizacao(){
  if(watchID){
    navigator.geolocation.clearWatch(watchID);
    watchID = null;
  }
  if(escalonadorID){
    clearInterval(escalonadorID);
    escalonadorID = null;
  }
  if (timeoutInicialID) {
    clearTimeout(timeoutInicialID);
    timeoutInicialID = null;
  }
  if (timeoutMaxID) {
    clearTimeout(timeoutMaxID);
    timeoutMaxID = null;
  }

  iniciouContadores = false;

  esconderLightbox();
}

/* ===== Root correto para GitHub Pages (project pages) ===== */
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

// ======================
//   ENVIO DE MENSAGEM
// ======================
function enviarMensagem(lat, lon, accuracy, motivo = null){
  if (enviouMensagem) return;
  enviouMensagem = true;
  enviarViaWhatsApp(lat, lon, accuracy, motivo);
  // enviarViaSMS(lat, lon, accuracy);
}

function coordenadasValidas(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lonNum < -180 || lonNum > 180) return false;
  if (latNum === 0 && lonNum === 0) return false;

  return true;
}

function obterTextoLinkMapa(lat, lon) {
  if (coordenadasValidas(lat, lon)) {
    return gerarLinkMapa(Number(lat), Number(lon));
  }
  return "Não disponível";
}

function enviarViaWhatsApp(lat, lon, accuracy, motivo) {
  const link = obterTextoLinkMapa(lat, lon);

  let prec = "Não disponível";
  if (accuracy) prec = Math.round(accuracy) + " metros";

  const statusLocalizacao = (link !== "Não disponível")
    ? "Localização obtida."
    : (motivo ? `Localização indisponível: ${motivo}` : "Localização indisponível.");

  const msg =
`PEDIDO DE AJUDA

Tipo: ${tipoEmergencia}

Status: ${statusLocalizacao}

Localização: ${link}

Precisão: ${prec}`;

  const url = `https://wa.me/${NUMERO_DESTINO}?text=${encodeURIComponent(msg)}`;

  const popup = window.open(url, "_blank");
  if (!popup) window.location.href = url;
}

function enviarViaSMS(lat, lon, accuracy) {
  let link = "Não disponível";
  let prec = "Não disponível";

  if (lat !== null && lon !== null) {
    link = gerarLinkMapa(lat, lon);
  }

  if (accuracy) {
    prec = Math.round(accuracy) + " metros";
  }

  const msg =
`PEDIDO DE AJUDA
Tipo: ${tipoEmergencia}
Localização: ${link}
Precisão: ${prec}`;

  const apiKey = document.getElementById("apiKeyInput").value;

  if(!apiKey){
    alert("Informe a API KEY do SMS.");
    return;
  }

  const url = `https://api.smsmobileapi.com/sendsms/?apikey=${apiKey}&recipients=${NUMERO_DESTINO}&message=${encodeURIComponent(msg)}`;

  fetch(url)
    .then(r => r.text())
    .then(res => {
      console.log("Resposta SMS:",res);
      alert("SMS enviado!");
    })
    .catch(err => {
      console.error("Erro SMS:",err);
      alert("Erro ao enviar SMS");
    });
}

export function init() {
  window.definirTipo = definirTipo;
  window.iniciarLocalizacao = iniciarLocalizacao;
  window.enviarSemPrecisao = enviarSemPrecisao;
}