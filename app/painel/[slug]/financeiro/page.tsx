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
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSessao } from "@/lib/auth";
import { getDespesas, getReceitas } from "@/lib/data";
import {
  agruparPorMes,
  calcularDRE,
  calcularKpisFinanceiro,
  ultimosMeses,
} from "@/lib/financeiro";
import { formatBRL } from "@/lib/utils";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";

export const dynamic = "force-dynamic";

export default async function FinanceiroOverviewPage({
  params,
}: {
  params: { slug: string };
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
  const desde = `${ultimosMeses(6)[0].chave}-01`;

  const [receitas, despesas] = await Promise.all([
    getReceitas(sessao.academia.id, desde),
    getDespesas(sessao.academia.id, desde),
  ]);

  const kpis = calcularKpisFinanceiro(receitas, despesas);
  const dadosMensais = agruparPorMes(receitas, despesas, 6);
  const dre = calcularDRE(receitas, despesas);
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

      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-volt-300" />
          <h2 className="font-semibold text-white">Receita x Despesa (mensal)</h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">Últimos 6 meses, valores pagos</p>
        <GraficoFinanceiroMensal dados={dadosMensais} />
      </div>

      <DREResumo dre={dre} periodo="Últimos 6 meses" />
    </div>
  );
}
