// Dias da semana das fichas de treino (migration 083). Convenção ISO-8601:
// 1 = segunda … 7 = domingo. Compartilhado entre o seletor de dias do app do
// aluno e o seletor de dias do painel do instrutor — uma única fonte de
// verdade para rótulos e para "que dia é hoje" no fuso da academia.

import { FUSO_ACADEMIA } from "./utils";

/** Número ISO de um dia (1=seg … 7=dom). */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIAS_SEMANA: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 7];

/** Rótulo curto para chips/seletor (maiúsculas, estilo app fitness). */
export const ROTULO_DIA_CURTO: Record<DiaSemana, string> = {
  1: "SEG",
  2: "TER",
  3: "QUA",
  4: "QUI",
  5: "SEX",
  6: "SÁB",
  7: "DOM",
};

/** Rótulo por extenso (ex.: para textos "Treino de segunda-feira"). */
export const ROTULO_DIA_LONGO: Record<DiaSemana, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

// Intl devolve o dia em inglês; mapeamos para o número ISO. Sunday=7 (não 0).
const ISO_POR_NOME_EN: Record<string, DiaSemana> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Dia da semana de HOJE (1=seg … 7=dom) no fuso da academia — nunca no fuso do
 * processo (que é UTC no servidor). Usado para destacar o dia atual no seletor
 * e escolher o treino do dia. Mesmo princípio de `hojeSaoPaulo()`.
 */
export function diaSemanaHojeSaoPaulo(agora: Date = new Date()): DiaSemana {
  const nome = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_ACADEMIA,
    weekday: "short",
  }).format(agora);
  return ISO_POR_NOME_EN[nome] ?? 1;
}

/** Normaliza um array vindo do banco/cliente: só 1..7, sem repetição, ordenado. */
export function normalizarDias(dias: unknown): DiaSemana[] {
  if (!Array.isArray(dias)) return [];
  const set = new Set<DiaSemana>();
  for (const d of dias) {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 1 && n <= 7) set.add(n as DiaSemana);
  }
  return [...set].sort((a, b) => a - b);
}

/** true se a ficha se aplica ao dia informado. */
export function treinoAplicaNoDia(dias: number[], dia: DiaSemana): boolean {
  return dias.includes(dia);
}

/**
 * Resumo textual dos dias de uma ficha para exibição compacta.
 * [] → "Sem dia definido"; todos os 7 → "Todos os dias"; senão "Seg · Qua · Sex".
 */
export function resumoDias(dias: number[]): string {
  const norm = normalizarDias(dias);
  if (norm.length === 0) return "Sem dia definido";
  if (norm.length === 7) return "Todos os dias";
  return norm.map((d) => ROTULO_DIA_CURTO[d]).join(" · ");
}
