// Agregações financeiras puras (sem I/O) — usadas pela página Financeiro e
// pelo Dashboard, a partir das receitas/despesas já buscadas do banco.

import { PontoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import { Despesa, Receita } from "./types";

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

  for (const r of receitas) {
    if (r.status !== "pago") continue;
    const k = chaveMes(r.data);
    receitaPorMes.set(k, (receitaPorMes.get(k) ?? 0) + Number(r.valor));
  }
  for (const d of despesas) {
    if (d.status !== "pago") continue;
    const k = chaveMes(d.data);
    despesaPorMes.set(k, (despesaPorMes.get(k) ?? 0) + Number(d.valor));
  }

  return janela.map(({ chave, label }) => ({
    mes: label,
    receita: Math.round((receitaPorMes.get(chave) ?? 0) * 100) / 100,
    despesa: Math.round((despesaPorMes.get(chave) ?? 0) * 100) / 100,
  }));
}

/** Receita e despesa (apenas pagas) agrupadas por dia (últimos `dias` dias). */
export function agruparPorDia(
  receitas: Receita[],
  despesas: Despesa[],
  dias: number
): PontoFinanceiroMensal[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  const receitaPorDia = new Map<string, number>();
  const despesaPorDia = new Map<string, number>();

  for (const r of receitas) {
    if (r.status !== "pago") continue;
    receitaPorDia.set(r.data, (receitaPorDia.get(r.data) ?? 0) + Number(r.valor));
  }
  for (const d of despesas) {
    if (d.status !== "pago") continue;
    despesaPorDia.set(d.data, (despesaPorDia.get(d.data) ?? 0) + Number(d.valor));
  }

  const hoje = new Date();
  const out: PontoFinanceiroMensal[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
    const chave = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    out.push({
      mes: `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}`,
      receita: Math.round((receitaPorDia.get(chave) ?? 0) * 100) / 100,
      despesa: Math.round((despesaPorDia.get(chave) ?? 0) * 100) / 100,
    });
  }
  return out;
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
