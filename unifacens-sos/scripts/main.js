// Página inicial (index.html)
// Atualmente é uma página de navegação, sem lógica.

export function init() {
  // Se no futuro você quiser analytics simples, rastrear cliques etc., faça aqui.
}

/*
 * Nota:
 * Este arquivo manteve o código antigo por histórico, mas não é mais necessário
 * para o index. Se você quiser, pode apagar todo o restante e manter apenas o init.
 */

const NUMERO_DESTINO = "5515981144802";

const SITE_MAPA = "https://www.google.com/maps";

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
let inicioTentativa = null;     // timestamp do início

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
    inicioTentativa = Date.now();

    mostrarLightbox("<b>Localizando</b><br>Tentando precisão de 15m…");

    // inicia escalonamento (libera botão após 3s e relaxa meta depois)
    iniciarEscalonamentoMeta();

    watchID = navigator.geolocation.watchPosition(
        pos => {
        ultimoLat = pos.coords.latitude;
        ultimoLon = pos.coords.longitude;
        ultimaPrecisao = pos.coords.accuracy;

        // feedback simples (sem mexer no botão)
        const precTxt = ultimaPrecisao ? Math.round(ultimaPrecisao) + "m" : "—";
        document.querySelector("#lightbox p").innerHTML =
            `<b>Localizando</b><br>Precisão atual: ${precTxt}<br>Meta: ${metaPrecisao}m`;

        // se atingiu a meta atual, envia automaticamente
        if(ultimaPrecisao !== null && ultimaPrecisao <= metaPrecisao){
            pararLocalizacao();
            enviarMensagem(ultimoLat, ultimoLon, ultimaPrecisao);
        }
        },
        err => {
        pararLocalizacao();
        enviarMensagem(null,null,null);
        },
        {
        enableHighAccuracy:true,
        maximumAge:0,
        timeout:20000
        }
    );
}

function iniciarEscalonamentoMeta(){
    // limpa por segurança
    if(escalonadorID) clearInterval(escalonadorID);

    escalonadorID = setInterval(() => {
        const agora = Date.now();
        const passou3s = (agora - inicioTentativa) >= 3000;

        if(!passou3s) return;

        // após 3s: libera o botão (uma única vez)
        liberarBotaoSemPrecisao();

        // depois que liberou, aumenta a meta de 5 em 5 a cada 3s
        metaPrecisao += 5;

        // opcional: atualizar texto para dar feedback
        document.querySelector("#lightbox p").innerHTML =
        `<b>Localizando</b><br>
        Precisão atual: ${ultimaPrecisao ? Math.round(ultimaPrecisao) + "m" : "—"}<br>
        Meta: ${metaPrecisao}m (relaxando)`;

    }, 3000);
}


function liberarBotaoSemPrecisao(){
    if(botaoLiberado) return; // trava: não deixa voltar
    botaoLiberado = true;
    document.getElementById("btnForcar").style.display = "block";
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
    esconderLightbox();
}

// ======================
//   ENVIO DE MENSAGEM
// ======================

function enviarMensagem(lat,lon,accuracy){
    // ===== CAMINHO WHATSAPP =====
    enviarViaWhatsApp(lat,lon,accuracy);

    // ===== CAMINHO SMS =====
    // Para ativar SMS, comente a linha acima 👆 e descomente a de baixo 👇
    // enviarViaSMS(lat,lon,accuracy);
}

function enviarViaWhatsApp(lat,lon,accuracy){
let link = "Não disponível";
let prec = "Não disponível";

if(lat !== null && lon !== null){
    link = `${SITE_MAPA}?q=${lat},${lon}`;
}
if(accuracy){
    prec = Math.round(accuracy) + " metros";
}

const msg =
`PEDIDO DE AJUDA

Tipo: ${tipoEmergencia}

Localização: ${link}

Precisão: ${prec}`;

const url = `https://wa.me/${NUMERO_DESTINO}?text=${encodeURIComponent(msg)}`;
window.open(url,"_blank");
}

function enviarViaSMS(lat,lon,accuracy){
let link = "Não disponível";
let prec = "Não disponível";

if(lat !== null && lon !== null){
    link = `${SITE_MAPA}?q=${lat},${lon}`;
}

if(accuracy){
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