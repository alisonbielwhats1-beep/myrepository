// Resolução de período para os filtros do Financeiro (dia / semana / mês / ano).
// Trabalha só com strings ISO "YYYY-MM-DD" para evitar problemas de fuso.

export type Granularidade = "dia" | "semana" | "mes" | "ano";

export const GRANULARIDADES: { valor: Granularidade; label: string }[] = [
  { valor: "dia", label: "Dia" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "ano", label: "Ano" },
];

export interface Periodo {
  gran: Granularidade;
  ref: string; // data de referência YYYY-MM-DD
  inicio: string;
  fim: string;
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parse(s?: string): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Resolve o intervalo [inicio, fim] e um rótulo legível para o período. */
export function resolverPeriodo(searchParams: {
  gran?: string;
  ref?: string;
}): Periodo {
  const gran: Granularidade = (["dia", "semana", "mes", "ano"] as const).includes(
    searchParams.gran as Granularidade
  )
    ? (searchParams.gran as Granularidade)
    : "mes";
  const ref = parse(searchParams.ref);

  let inicio: Date;
  let fim: Date;
  let label: string;

  if (gran === "dia") {
    inicio = new Date(ref);
    fim = new Date(ref);
    label = ref.toLocaleDateString("pt-BR");
  } else if (gran === "semana") {
    const diaSemana = (ref.getDay() + 6) % 7; // segunda = 0
    inicio = new Date(ref);
    inicio.setDate(ref.getDate() - diaSemana);
    fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    label = `${inicio.toLocaleDateString("pt-BR")} – ${fim.toLocaleDateString("pt-BR")}`;
  } else if (gran === "ano") {
    inicio = new Date(ref.getFullYear(), 0, 1);
    fim = new Date(ref.getFullYear(), 11, 31);
    label = String(ref.getFullYear());
  } else {
    // mês
    inicio = new Date(ref.getFullYear(), ref.getMonth(), 1);
    fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    label = `${NOMES_MES[ref.getMonth()]} de ${ref.getFullYear()}`;
  }

  return { gran, ref: iso(ref), inicio: iso(inicio), fim: iso(fim), label };
}

// ---------------------------------------------------------------------------
// Janela do Dashboard (filtro: semana atual / último mês / 6 meses / 12 meses)
// ---------------------------------------------------------------------------

export type RangeDashboard = "semana" | "mes" | "6meses" | "12meses";

export const RANGES_DASHBOARD: { valor: RangeDashboard; label: string }[] = [
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "6meses", label: "6 meses" },
  { valor: "12meses", label: "12 meses" },
];

export interface JanelaDashboard {
  range: RangeDashboard;
  label: string;
  desde: string; // ISO YYYY-MM-DD — início da janela
  dias: number;
  meses: number;
  porDia: boolean; // true = gráfico por dia; false = por mês
}

/** Resolve a janela do Dashboard a partir do parâmetro `range`. */
export function resolverJanelaDashboard(range?: string): JanelaDashboard {
  const r: RangeDashboard = (
    ["semana", "mes", "6meses", "12meses"] as const
  ).includes(range as RangeDashboard)
    ? (range as RangeDashboard)
    : "6meses";

  const hoje = new Date();
  let dias: number;
  let meses: number;
  let porDia: boolean;

  if (r === "semana") {
    dias = 7;
    meses = 1;
    porDia = true;
  } else if (r === "mes") {
    dias = 30;
    meses = 1;
    porDia = true;
  } else if (r === "12meses") {
    dias = 365;
    meses = 12;
    porDia = false;
  } else {
    dias = 183;
    meses = 6;
    porDia = false;
  }

  const inicio = porDia
    ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (dias - 1))
    : new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);

  return {
    range: r,
    label: RANGES_DASHBOARD.find((x) => x.valor === r)!.label,
    desde: iso(inicio),
    dias,
    meses,
    porDia,
  };
}

/** Data de referência ao navegar para o período anterior/seguinte. */
export function deslocar(p: Periodo, dir: 1 | -1): string {
  const d = parse(p.ref);
  if (p.gran === "dia") d.setDate(d.getDate() + dir);
  else if (p.gran === "semana") d.setDate(d.getDate() + 7 * dir);
  else if (p.gran === "ano") d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  return iso(d);
}
