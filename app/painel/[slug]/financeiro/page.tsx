import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import { GraficoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import DREResumo from "@/components/painel/financeiro/DREResumo";
import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSessao } from "@/lib/auth";
import { getDespesas, getReceitas } from "@/lib/data";
import {
  agruparFinanceiro,
  calcularDRE,
  calcularKpisFinanceiro,
  ultimosMeses,
} from "@/lib/financeiro";
import { resolverPeriodo } from "@/lib/periodo";
import { formatBRL } from "@/lib/utils";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";

export const dynamic = "force-dynamic";

export default async function FinanceiroOverviewPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { gran?: string; ref?: string; de?: string; ate?: string };
}) {
  const sessao = await requireSessao(params.slug);

  if (!planoPodeAcessar(sessao.academia.plano_saas, "financeiro")) {
    return (
      <UpgradeGuard
        recurso="financeiro"
        planoAtual={sessao.academia.plano_saas}
        planoNecessario={planoMinimo("financeiro")}
        slug={params.slug}
        titulo="Financeiro disponível no Profissional"
        descricao="Controle receitas, despesas, DRE e fluxo de caixa da sua academia."
      />
    );
  }
  const periodo = resolverPeriodo(searchParams);
  const desde = `${ultimosMeses(6)[0].chave}-01`;

  // Duas janelas: uma fixa (6 meses) para os KPIs/projeção do topo, e a do
  // filtro selecionado para o gráfico Receita x Despesa x Projetado e o DRE.
  const [receitas, despesas, receitasPeriodo, despesasPeriodo] = await Promise.all([
    getReceitas(sessao.academia.id, desde),
    getDespesas(sessao.academia.id, desde),
    getReceitas(sessao.academia.id, periodo.inicio, periodo.fim),
    getDespesas(sessao.academia.id, periodo.inicio, periodo.fim),
  ]);

  const kpis = calcularKpisFinanceiro(receitas, despesas);
  const dadosPeriodo = agruparFinanceiro(
    receitasPeriodo,
    despesasPeriodo,
    periodo.inicio,
    periodo.fim
  );
  const dre = calcularDRE(receitasPeriodo, despesasPeriodo);
  // Saldo projetado = caixa atual + a receber - a pagar (pendências futuras).
  const saldoProjetado =
    kpis.fluxoCaixa + kpis.receitasPendentes - kpis.despesasPendentes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={ArrowUpCircle}
          label="Receita do mês"
          value={formatBRL(kpis.receitaMes, { compacto: true })}
          hint="Pagas neste mês"
          accent="volt"
        />
        <StatTile
          icon={ArrowDownCircle}
          label="Despesa do mês"
          value={formatBRL(kpis.despesaMes, { compacto: true })}
          hint="Pagas neste mês"
          accent="magenta"
        />
        <StatTile
          icon={Scale}
          label="Lucro do mês"
          value={formatBRL(kpis.lucroMes, { compacto: true })}
          hint="Receita - despesa"
          accent={kpis.lucroMes >= 0 ? "volt" : "magenta"}
        />
        <StatTile
          icon={Wallet}
          label="Fluxo de caixa"
          value={formatBRL(kpis.fluxoCaixa, { compacto: true })}
          hint="Acumulado (pagos)"
          accent="cyan"
        />
      </div>

      {/* Projeção de caixa */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          icon={ArrowUpCircle}
          label="A receber"
          value={formatBRL(kpis.receitasPendentes, { compacto: true })}
          hint="pendências futuras"
          accent="volt"
        />
        <StatTile
          icon={ArrowDownCircle}
          label="A pagar"
          value={formatBRL(kpis.despesasPendentes, { compacto: true })}
          hint="pendências futuras"
          accent="magenta"
        />
        <StatTile
          icon={TrendingUp}
          label="Saldo projetado"
          value={formatBRL(saldoProjetado, { compacto: true })}
          hint="caixa + a receber - a pagar"
          accent={saldoProjetado >= 0 ? "cyan" : "magenta"}
        />
      </div>

      <PeriodoFilter periodo={periodo} />

      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-volt-300" />
          <h2 className="font-semibold text-white">Receita x Despesa x Projetado</h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Barras = valores pagos · linha tracejada = saldo projetado (inclui o que
          está a receber / a pagar no período)
        </p>
        <GraficoFinanceiroMensal dados={dadosPeriodo} />
      </div>

      <DREResumo dre={dre} periodo={periodo.label} />
    </div>
  );
}
