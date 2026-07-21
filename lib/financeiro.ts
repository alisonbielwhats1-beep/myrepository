// Agregações financeiras puras (sem I/O) — usadas pela página Financeiro e
// pelo Dashboard, a partir das receitas/despesas já buscadas do banco.

import { PontoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import {
  CategoriaDespesa,
  Despesa,
  Receita,
  TipoReceita,
} from "./types";

const NOMES_MES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function chaveMes(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

/** Últimos `meses` meses (incluindo o atual), do mais antigo ao mais recente. */
export function ultimosMeses(meses: number): { chave: string; label: string }[] {
  const hoje = new Date();
  const out: { chave: string; label: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ chave, label: NOMES_MES[d.getMonth()] });
  }
  return out;
}

/** Receita e despesa (apenas pagas) agrupadas por mês, para o gráfico. */
export function agruparPorMes(
  receitas: Receita[],
  despesas: Despesa[],
  meses = 6
): PontoFinanceiroMensal[] {
  const janela = ultimosMeses(meses);
  const receitaPorMes = new Map<string, number>();
  const despesaPorMes = new Map<string, number>();
  // "Previsto" = todos os lançamentos do mês (pagos + pendentes), usado para a
  // linha de saldo projetado — inclui o que ainda está a receber / a pagar.
  const receitaPrevistaPorMes = new Map<string, number>();
  const despesaPrevistaPorMes = new Map<string, number>();

  for (const r of receitas) {
    const k = chaveMes(r.data);
    receitaPrevistaPorMes.set(k, (receitaPrevistaPorMes.get(k) ?? 0) + Number(r.valor));
    if (r.status !== "pago") continue;
    receitaPorMes.set(k, (receitaPorMes.get(k) ?? 0) + Number(r.valor));
  }
  for (const d of despesas) {
    const k = chaveMes(d.data);
    despesaPrevistaPorMes.set(k, (despesaPrevistaPorMes.get(k) ?? 0) + Number(d.valor));
    if (d.status !== "pago") continue;
    despesaPorMes.set(k, (despesaPorMes.get(k) ?? 0) + Number(d.valor));
  }

  const arred = (n: number) => Math.round(n * 100) / 100;

  return janela.map(({ chave, label }) => ({
    mes: label,
    receita: arred(receitaPorMes.get(chave) ?? 0),
    despesa: arred(despesaPorMes.get(chave) ?? 0),
    projetado: arred(
      (receitaPrevistaPorMes.get(chave) ?? 0) - (despesaPrevistaPorMes.get(chave) ?? 0)
    ),
  }));
}

/**
 * Receita e despesa (apenas pagas) agrupadas para o gráfico, dentro do
 * intervalo [desde, ate] (ISO). Escolhe automaticamente a granularidade:
 * por dia se o período tem até ~2 meses, por mês se for mais longo.
 */
export function agruparFinanceiro(
  receitas: Receita[],
  despesas: Despesa[],
  desde: string,
  ate: string
): PontoFinanceiroMensal[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dDesde = new Date(desde + "T00:00:00");
  const dAte = new Date(ate + "T00:00:00");
  const spanDias =
    Math.round((dAte.getTime() - dDesde.getTime()) / 86400_000) + 1;

  const receitaPago = new Map<string, number>();
  const despesaPago = new Map<string, number>();
  // "Previsto" = pagos + pendentes, base da linha de saldo projetado.
  const receitaPrev = new Map<string, number>();
  const despesaPrev = new Map<string, number>();
  const arred = (n: number) => Math.round(n * 100) / 100;

  if (spanDias <= 62) {
    // Granularidade diária.
    for (const r of receitas) {
      if (r.data < desde || r.data > ate) continue;
      receitaPrev.set(r.data, (receitaPrev.get(r.data) ?? 0) + Number(r.valor));
      if (r.status !== "pago") continue;
      receitaPago.set(r.data, (receitaPago.get(r.data) ?? 0) + Number(r.valor));
    }
    for (const d of despesas) {
      if (d.data < desde || d.data > ate) continue;
      despesaPrev.set(d.data, (despesaPrev.get(d.data) ?? 0) + Number(d.valor));
      if (d.status !== "pago") continue;
      despesaPago.set(d.data, (despesaPago.get(d.data) ?? 0) + Number(d.valor));
    }
    const out: PontoFinanceiroMensal[] = [];
    for (let i = 0; i < spanDias; i++) {
      const dt = new Date(dDesde.getFullYear(), dDesde.getMonth(), dDesde.getDate() + i);
      const chave = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      out.push({
        mes: `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`,
        receita: arred(receitaPago.get(chave) ?? 0),
        despesa: arred(despesaPago.get(chave) ?? 0),
        projetado: arred((receitaPrev.get(chave) ?? 0) - (despesaPrev.get(chave) ?? 0)),
      });
    }
    return out;
  }

  // Granularidade mensal.
  for (const r of receitas) {
    if (r.data < desde || r.data > ate) continue;
    const k = chaveMes(r.data);
    receitaPrev.set(k, (receitaPrev.get(k) ?? 0) + Number(r.valor));
    if (r.status !== "pago") continue;
    receitaPago.set(k, (receitaPago.get(k) ?? 0) + Number(r.valor));
  }
  for (const d of despesas) {
    if (d.data < desde || d.data > ate) continue;
    const k = chaveMes(d.data);
    despesaPrev.set(k, (despesaPrev.get(k) ?? 0) + Number(d.valor));
    if (d.status !== "pago") continue;
    despesaPago.set(k, (despesaPago.get(k) ?? 0) + Number(d.valor));
  }
  const out: PontoFinanceiroMensal[] = [];
  let cursor = new Date(dDesde.getFullYear(), dDesde.getMonth(), 1);
  const fim = new Date(dAte.getFullYear(), dAte.getMonth(), 1);
  while (cursor <= fim) {
    const k = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
    out.push({
      mes: NOMES_MES[cursor.getMonth()],
      receita: arred(receitaPago.get(k) ?? 0),
      despesa: arred(despesaPago.get(k) ?? 0),
      projetado: arred((receitaPrev.get(k) ?? 0) - (despesaPrev.get(k) ?? 0)),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

export interface LinhaDRE<T> {
  chave: T;
  total: number;
}

export interface DRE {
  receitasPorTipo: LinhaDRE<TipoReceita>[];
  despesasPorCategoria: LinhaDRE<CategoriaDespesa>[];
  totalReceita: number;
  totalDespesa: number;
  lucro: number;
  margem: number; // % do lucro sobre a receita
}

/**
 * DRE simples (só valores pagos): receita por tipo, despesa por categoria,
 * lucro e margem. Considera receitas/despesas já filtradas para o período.
 */
export function calcularDRE(receitas: Receita[], despesas: Despesa[]): DRE {
  const recMap = new Map<TipoReceita, number>();
  const despMap = new Map<CategoriaDespesa, number>();

  for (const r of receitas) {
    if (r.status !== "pago") continue;
    recMap.set(r.tipo, (recMap.get(r.tipo) ?? 0) + Number(r.valor));
  }
  for (const d of despesas) {
    if (d.status !== "pago") continue;
    despMap.set(d.categoria, (despMap.get(d.categoria) ?? 0) + Number(d.valor));
  }

  const receitasPorTipo = Array.from(recMap.entries())
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total);
  const despesasPorCategoria = Array.from(despMap.entries())
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total);

  const totalReceita = receitasPorTipo.reduce((a, l) => a + l.total, 0);
  const totalDespesa = despesasPorCategoria.reduce((a, l) => a + l.total, 0);
  const lucro = totalReceita - totalDespesa;
  const margem = totalReceita > 0 ? (lucro / totalReceita) * 100 : 0;

  return {
    receitasPorTipo,
    despesasPorCategoria,
    totalReceita,
    totalDespesa,
    lucro,
    margem,
  };
}

export interface KpisFinanceiro {
  receitaMes: number;
  despesaMes: number;
  lucroMes: number;
  receitasPendentes: number;
  despesasPendentes: number;
  fluxoCaixa: number;
}

/** KPIs do mês corrente + fluxo de caixa acumulado (sobre o período buscado). */
export function calcularKpisFinanceiro(
  receitas: Receita[],
  despesas: Despesa[]
): KpisFinanceiro {
  const mesAtual = chaveMes(new Date().toISOString());

  const receitaMes = receitas
    .filter((r) => r.status === "pago" && chaveMes(r.data) === mesAtual)
    .reduce((acc, r) => acc + Number(r.valor), 0);

  const despesaMes = despesas
    .filter((d) => d.status === "pago" && chaveMes(d.data) === mesAtual)
    .reduce((acc, d) => acc + Number(d.valor), 0);

  const receitasPendentes = receitas
    .filter((r) => r.status === "pendente")
    .reduce((acc, r) => acc + Number(r.valor), 0);

  const despesasPendentes = despesas
    .filter((d) => d.status === "pendente")
    .reduce((acc, d) => acc + Number(d.valor), 0);

  const fluxoCaixa =
    receitas
      .filter((r) => r.status === "pago")
      .reduce((acc, r) => acc + Number(r.valor), 0) -
    despesas
      .filter((d) => d.status === "pago")
      .reduce((acc, d) => acc + Number(d.valor), 0);

  return {
    receitaMes,
    despesaMes,
    lucroMes: receitaMes - despesaMes,
    receitasPendentes,
    despesasPendentes,
    fluxoCaixa,
  };
}
