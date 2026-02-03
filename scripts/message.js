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
let timeoutInicialID = null;    // timestamp do início
let enviouMensagem = false;

// ===== Helpers de feedback do Lightbox (NOVO) =====
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

  // quando inicia uma nova tentativa, botão começa oculto
  document.getElementById("btnForcar").style.display = "none";
}

function esconderLightbox(){
    document.getElementById("lightbox").style.display="none";
    clearTimeout(timerBotao);
    clearTimeout(timerSemGps);
}

function iniciarLocalizacao(){

    if(!navigator.geolocation){
        enviarMensagem(null,null,null);
        return;
    }

    // reset de valores
    ultimoLat = null;
    ultimoLon = null;
    ultimaPrecisao = null;

    // reset da lógica
    metaPrecisao = 15;
    botaoLiberado = false;

    enviouMensagem = false;

    // ===== Feedback inicial (AJUSTADO) =====
    mostrarLightbox("<b>Buscando localização…</b><br>Ative o GPS e mantenha-se em local aberto, se possível.");
    atualizarLightbox({
      titulo: "Buscando localização…",
      linha1: `Meta inicial: ${metaPrecisao}m`,
      rodape: "Isso pode levar alguns segundos."
    });

    // inicia escalonamento (libera botão após 3s e relaxa meta depois)
    iniciarEscalonamentoMeta();

    const TEMPO_MAX_MS = 20000;

    setTimeout(() => {
        if (enviouMensagem) return;

        pararLocalizacao();

        if (coordenadasValidas(ultimoLat, ultimoLon)) {
            enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao, "Tempo máximo atingido.");
        } else {
            enviarMensagem(null, null, null, "Tempo máximo atingido e sem coordenadas.");
        }
    }, TEMPO_MAX_MS);


    watchID = navigator.geolocation.watchPosition(
        pos => {
        ultimoLat = pos.coords.latitude;
        ultimoLon = pos.coords.longitude;
        ultimaPrecisao = pos.coords.accuracy;



        // TEMPORÁRIO
        console.log("[GPS]", {
            lat: ultimoLat,
            lon: ultimoLon,
            acc: ultimaPrecisao,
            meta: metaPrecisao
        });




        // ===== Feedback durante a localização (AJUSTADO) =====
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

        // se atingiu a meta atual, envia automaticamente
        if(ultimaPrecisao !== null && ultimaPrecisao <= metaPrecisao){
            // ===== Feedback no envio automático (AJUSTADO) =====
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

            // feedback local
            const motivo =
                err?.code === 1 ? "Permissão de localização negada." :
                err?.code === 2 ? "Não foi possível obter o GPS (sinal fraco/indisponível)." :
                err?.code === 3 ? "Tempo esgotado ao tentar obter a localização." :
                "Falha ao obter a localização.";

            // ===== Feedback de erro (AJUSTADO) =====
            mostrarLightbox(`<b>Localização indisponível</b><br>${motivo}<br><br>Enviando alerta sem coordenadas…`);

            // envia sem coordenadas, mas com contexto
            enviarMensagem(null, null, null, motivo);
            },
        {
        enableHighAccuracy:true,
        maximumAge:0,
        timeout:20000
        }
    );
}

function iniciarEscalonamentoMeta() {
  // limpa por segurança
  if (timeoutInicialID) clearTimeout(timeoutInicialID);
  if (escalonadorID) clearInterval(escalonadorID);

  // 1) janela inicial de 5s tentando 15m
  timeoutInicialID = setTimeout(() => {
    liberarBotaoSemPrecisao();

    // 2) após 5s, relaxa a meta 10m a cada 2s
    escalonadorID = setInterval(() => {
      metaPrecisao += 10;

      // ===== Feedback no relaxamento (AJUSTADO) =====
      atualizarLightbox({
        titulo: "Aprimorando precisão…",
        linha1: `Precisão atual: ${textoPrecisao(ultimaPrecisao)}`,
        linha2: `Meta ajustada: ${metaPrecisao}m`,
        rodape: "Se a meta não for atingida, você ainda pode enviar manualmente."
      });
      
      // se já tem coords e a meta ficou suficiente, dispara envio
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
    if(botaoLiberado) return; // trava: não deixa voltar
    botaoLiberado = true;
    document.getElementById("btnForcar").style.display = "block";

    // ===== Feedback ao liberar botão (AJUSTADO) =====
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
    esconderLightbox();
}

function gerarLinkMapa(lat, lon) {
    const base = window.location.origin; // ex.: https://seu-dominio.com
    const pathMapa = "/pages/map.html";  // ajuste conforme seu projeto
    const url = new URL(pathMapa, base);
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

    // ===== CAMINHO SMS =====
    // Para ativar SMS, comente a linha acima 👆 e descomente a de baixo 👇
    // enviarViaSMS(lat,lon,accuracy);
}

function coordenadasValidas(lat, lon) {
  const latNum = Number(lat);
  const lonNum = Number(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;

  // Intervalos reais
  if (latNum < -90 || latNum > 90) return false;
  if (lonNum < -180 || lonNum > 180) return false;

  // Bloqueia coordenadas zeradas
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

    // Se o navegador bloquear o pop-up, abre na mesma aba
    if (!popup) {
    window.location.href = url;
    }
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