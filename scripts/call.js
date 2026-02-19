function parseHideDays(attr) {
    if (!attr) return [];
    return attr
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(n => Number(n))
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 7);
}

// Retorna 1..7 (dom..sáb) baseado em America/Sao_Paulo
function getWeekdaySaoPaulo(date = new Date()) {
    const weekdayName = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        weekday: "long",
    }).format(date);

    const map = {
        "domingo": 1,
        "segunda-feira": 2,
        "terça-feira": 3,
        "quarta-feira": 4,
        "quinta-feira": 5,
        "sexta-feira": 6,
        "sábado": 7,
    };

    return map[weekdayName];
}

function aplicarRegrasPorDia() {
    const dow = getWeekdaySaoPaulo();

    document.querySelectorAll("[data-hide-days]").forEach((el) => {
        const hideDays = parseHideDays(el.getAttribute("data-hide-days"));
        const shouldHide = hideDays.includes(dow);
        el.classList.toggle("is-hidden", shouldHide);
    });

// COMPORTAMENTO DINÂMICO DE ESTILO DAQUI PRA BAIXO

    aplicarFallbackLayoutQuandoGridImpar();
}

// TEMP: odd grid fallback (remove this block later if no longer needed)
const ODD_GRID_CLASS = "js-odd-grid-fallback";
const ODD_GRID_STYLE_ID = "call-odd-grid-fallback-style";

function garantirEstilosFallbackGridImpar() {
    if (document.getElementById(ODD_GRID_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = ODD_GRID_STYLE_ID;
    style.textContent = `
body[data-page="call"] .container main .grid.${ODD_GRID_CLASS} {
    display: block;
    grid-template-columns: none;
    gap: normal;
}

body[data-page="call"] .container main .grid.${ODD_GRID_CLASS} .btn {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: none;
    justify-items: normal;
    gap: 0;
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

// COMPORTAMENTO DINÂMICO DE ESTILO DAQUI PRA CIMA

}

export function init() {
    aplicarRegrasPorDia();
}