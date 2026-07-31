import { estaDisponivelAgora } from "./availability.js";

// ======================
// CONFIG
// ======================
// Dias: 1=domingo, 2=segunda, ..., 7=sábado.
// Horários são avaliados no fuso America/Sao_Paulo e incluem início e fim.
const CONTATOS_CONFIG_POR_SETOR = {
  "PORTARIA": {
    numero: "5515991966412",
    diasHabilitados: [1, 2, 3, 4, 5, 6, 7],
    horarioHabilitado: { inicio: "00:00", fim: "23:59" },
  },
  "AMBULATÓRIO": {
    numero: "5515981403334",
    diasHabilitados: [2, 3, 4, 5, 6],
    horarioHabilitado: { inicio: "08:00", fim: "17:30" },
  },
  "SEGURANÇA DO TRABALHO": {
    numero: "5515999999999",
    diasHabilitados: [],
    horarioHabilitado: { inicio: "08:00", fim: "17:30" },
  },
};

function normalizarNome(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const CONTATOS_CONFIG_NORMALIZADO = Object.fromEntries(
  Object.entries(CONTATOS_CONFIG_POR_SETOR).map(([setor, config]) => [
    normalizarNome(setor),
    config,
  ])
);

function obterNumeroValido(numero) {
  const somenteDigitos = String(numero || "").replace(/\D/g, "");
  return /^\d{10,15}$/.test(somenteDigitos) ? somenteDigitos : null;
}

function aplicarDisponibilidadeDosContatos() {
  document.querySelectorAll("[data-contact-sector]").forEach((elemento) => {
    const setor = normalizarNome(elemento.dataset.contactSector);
    const config = CONTATOS_CONFIG_NORMALIZADO[setor];
    const numero = obterNumeroValido(config?.numero);
    const disponivel = Boolean(numero) && estaDisponivelAgora(config);

    elemento.classList.toggle("is-hidden", !disponivel);

    if (disponivel) {
      elemento.setAttribute("href", `tel:+${numero}`);
      elemento.removeAttribute("aria-hidden");
      elemento.removeAttribute("tabindex");
    } else {
      elemento.removeAttribute("href");
      elemento.setAttribute("aria-hidden", "true");
      elemento.setAttribute("tabindex", "-1");
    }
  });

  aplicarFallbackLayoutQuandoGridImpar();
}

// COMPORTAMENTO DINÂMICO DE ESTILO DAQUI PRA BAIXO

// TEMP: odd grid fallback (remove this block later if no longer needed)
const ODD_GRID_CLASS = "js-odd-grid-fallback";
const ODD_GRID_STYLE_ID = "call-odd-grid-fallback-style";

function garantirEstilosFallbackGridImpar() {
  if (document.getElementById(ODD_GRID_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = ODD_GRID_STYLE_ID;
  style.textContent = `
body[data-page="call"] .container main .grid.${ODD_GRID_CLASS} {
    grid-template-columns: 1fr;
}

body[data-page="call"] .container main .grid.${ODD_GRID_CLASS} .btn {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
    justify-items: normal;
    gap: 8px;
    min-height: 7rem;
}
`;

  document.head.appendChild(style);
}

function aplicarFallbackLayoutQuandoGridImpar() {
  const grid = document.querySelector("body[data-page='call'] .container main .grid");
  if (!grid) return;

  const filhosVisiveis = Array.from(grid.children).filter((child) => {
    if (!(child instanceof HTMLElement)) return false;
    if (!child.classList.contains("btn")) return false;
    return !child.classList.contains("is-hidden");
  });

  const quantidadeImpar = filhosVisiveis.length % 2 === 1;
  if (!quantidadeImpar) {
    grid.classList.remove(ODD_GRID_CLASS);
    return;
  }

  garantirEstilosFallbackGridImpar();
  grid.classList.add(ODD_GRID_CLASS);
}

// COMPORTAMENTO DINÂMICO DE ESTILO DAQUI PRA CIMA

function atualizarAoRetornarParaPagina() {
  if (document.visibilityState === "visible") aplicarDisponibilidadeDosContatos();
}

export function init() {
  aplicarDisponibilidadeDosContatos();
  document.addEventListener("visibilitychange", atualizarAoRetornarParaPagina);
}
