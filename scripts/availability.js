const FUSO_HORARIO = "America/Sao_Paulo";

const DIA_POR_NOME_CURTO = Object.freeze({
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
  Sat: 7,
});

function obterPartesDataSaoPaulo(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_HORARIO,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const partes = formatter.formatToParts(date);
  const valores = {};

  partes.forEach((parte) => {
    if (parte.type !== "literal") valores[parte.type] = parte.value;
  });

  // Alguns navegadores representam meia-noite como 24:00.
  const hora = Number(valores.hour) % 24;
  const minuto = Number(valores.minute);

  return {
    diaSemana: DIA_POR_NOME_CURTO[valores.weekday],
    minutosDoDia: (hora * 60) + minuto,
  };
}

function horarioParaMinutos(horario) {
  const correspondencia = /^(\d{2}):(\d{2})$/.exec(String(horario || ""));
  if (!correspondencia) return null;

  const hora = Number(correspondencia[1]);
  const minuto = Number(correspondencia[2]);
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

  return (hora * 60) + minuto;
}

export function estaDisponivelAgora(config, date = new Date()) {
  if (!config || !Array.isArray(config.diasHabilitados)) return false;

  const inicio = horarioParaMinutos(config.horarioHabilitado?.inicio);
  const fim = horarioParaMinutos(config.horarioHabilitado?.fim);
  if (inicio == null || fim == null) return false;

  let atual;
  try {
    atual = obterPartesDataSaoPaulo(date);
  } catch {
    return false;
  }

  if (inicio <= fim) {
    return config.diasHabilitados.includes(atual.diaSemana)
      && atual.minutosDoDia >= inicio
      && atual.minutosDoDia <= fim;
  }

  // Também aceita janelas que atravessam a meia-noite, por exemplo 22:00–06:00.
  if (atual.minutosDoDia >= inicio) {
    return config.diasHabilitados.includes(atual.diaSemana);
  }

  const diaAnterior = atual.diaSemana === 1 ? 7 : atual.diaSemana - 1;
  return atual.minutosDoDia <= fim && config.diasHabilitados.includes(diaAnterior);
}
