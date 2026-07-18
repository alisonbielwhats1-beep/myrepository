import { ArrowDownCircle, ArrowUpCircle, BarChart3, Clock, Scale, Wallet } from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import { GraficoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import { requireSessao } from "@/lib/auth";
import { getDespesas, getReceitas } from "@/lib/data";
import { agruparPorMes, calcularKpisFinanceiro, ultimosMeses } from "@/lib/financeiro";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinanceiroOverviewPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const desde = `${ultimosMeses(6)[0].chave}-01`;

  const [receitas, despesas] = await Promise.all([
    getReceitas(sessao.academia.id, desde),
    getDespesas(sessao.academia.id, desde),
  ]);

  const kpis = calcularKpisFinanceiro(receitas, despesas);
  const dadosMensais = agruparPorMes(receitas, despesas, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={ArrowUpCircle}
          label="Receita do mês"
          value={formatBRL(kpis.receitaMes)}
          hint="Pagas neste mês"
          accent="volt"
        />
        <StatTile
          icon={ArrowDownCircle}
          label="Despesa do mês"
          value={formatBRL(kpis.despesaMes)}
          hint="Pagas neste mês"
          accent="magenta"
        />
        <StatTile
          icon={Scale}
          label="Lucro do mês"
          value={formatBRL(kpis.lucroMes)}
          hint="Receita - despesa"
          accent={kpis.lucroMes >= 0 ? "volt" : "magenta"}
        />
        <StatTile
          icon={Wallet}
          label="Fluxo de caixa"
          value={formatBRL(kpis.fluxoCaixa)}
          hint="Acumulado (pagos)"
          accent="cyan"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <Clock className="h-5 w-5 flex-none text-amber-400" />
          <div>
            <p className="text-sm text-slate-300">Receitas pendentes</p>
            <p className="font-semibold text-white">
              {formatBRL(kpis.receitasPendentes)}
            </p>
          </div>
        </div>
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <Clock className="h-5 w-5 flex-none text-amber-400" />
          <div>
            <p className="text-sm text-slate-300">Despesas pendentes</p>
            <p className="font-semibold text-white">
              {formatBRL(kpis.despesasPendentes)}
            </p>
          </div>
        </div>
      </div>

      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-volt-300" />
          <h2 className="font-semibold text-white">Receita x Despesa (mensal)</h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">Últimos 6 meses, valores pagos</p>
        <GraficoFinanceiroMensal dados={dadosMensais} />
      </div>
    </div>
  );
}
