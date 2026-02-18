function parseHideDays(attr) {
    if (!attr) return [];
    return attr
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(n => Number(n))
        .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
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
}

export function init() {
    aplicarRegrasPorDia();
}