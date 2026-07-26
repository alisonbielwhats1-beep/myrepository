import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import Ajuda from "@/components/ui/Ajuda";
import StatTile from "@/components/painel/StatTile";
import { GraficoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import DREResumo from "@/components/painel/financeiro/DREResumo";
import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import SaldoInicialCard from "@/components/painel/financeiro/SaldoInicialCard";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSessao } from "@/lib/auth";
import {
  getDreFinanceiro,
  getResumoFinanceiro,
  getSerieFinanceira,
} from "@/lib/data";
import {
  caixaDoResumo,
  calcularSaldoProjetado,
  incompletosDoResumo,
  montarDRE,
  montarSerie,
  pendenciasDoResumo,
  saldoDoResumo,
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

  // Toda a agregação acontece no Postgres (migration 031). O histórico
  // detalhado NUNCA é carregado aqui: as tabelas de Receitas e Despesas têm
  // suas próprias páginas, já filtradas por período.
  const spanDias =
    Math.round(
      (Date.parse(`${periodo.fim}T00:00:00Z`) -
        Date.parse(`${periodo.inicio}T00:00:00Z`)) /
        86_400_000
    ) + 1;
  const diario = spanDias <= 62;

  const [resumo, linhasDre, serie] = await Promise.all([
    getResumoFinanceiro(periodo.inicio, periodo.fim),
    getDreFinanceiro(periodo.inicio, periodo.fim),
    getSerieFinanceira(periodo.inicio, periodo.fim, diario),
  ]);

  const caixa = caixaDoResumo(resumo);
  const aReceber = pendenciasDoResumo(resumo, "receber");
  const aPagar = pendenciasDoResumo(resumo, "pagar");
  const saldo = saldoDoResumo(resumo);
  const projecao = calcularSaldoProjetado(saldo.saldo, aReceber.total, aPagar.total);
  const incompletos = incompletosDoResumo(resumo);
  const dre = montarDRE(linhasDre);
  const dadosPeriodo = montarSerie(serie, diario);

  return (
    <div className="space-y-6">
      <PeriodoFilter periodo={periodo} />

      {(incompletos.receitas > 0 || incompletos.despesas > 0) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <div className="space-y-1.5">
            {incompletos.receitas > 0 && (
              <p>
                <b>{incompletos.receitas}</b> receita(s) paga(s) sem data de pagamento
                ({formatBRL(incompletos.receitasValor)}) ficam de fora do dinheiro
                realizado.{" "}
                <Link
                  href={`/painel/${params.slug}/financeiro/receitas?status=pago&pagamento=sem_data`}
                  className="font-medium text-amber-100 underline underline-offset-2 hover:text-white"
                >
                  Corrigir agora
                </Link>
              </p>
            )}
            {incompletos.despesas > 0 && (
              <p>
                <b>{incompletos.despesas}</b> despesa(s) paga(s) sem data de pagamento
                ({formatBRL(incompletos.despesasValor)}) ficam de fora do dinheiro
                realizado.{" "}
                <Link
                  href={`/painel/${params.slug}/financeiro/despesas?pagamento=sem_data`}
                  className="font-medium text-amber-100 underline underline-offset-2 hover:text-white"
                >
                  Corrigir agora
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- A. Dinheiro realizado no período ---------- */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
          Dinheiro realizado · {periodo.label}
          <Ajuda texto="Só o que de fato entrou e saiu no período escolhido, pela data em que o pagamento aconteceu. O vencimento não conta aqui." />
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            icon={ArrowUpCircle}
            label="Receita recebida"
            value={formatBRL(caixa.receitaRecebida, { compacto: true })}
            hint="entrou no período"
            accent="volt"
            ajuda="Dinheiro que realmente entrou no período."
          />
          <StatTile
            icon={ArrowDownCircle}
            label="Despesa paga"
            value={formatBRL(caixa.despesaPaga, { compacto: true })}
            hint="saiu no período"
            accent="magenta"
            ajuda="Dinheiro que realmente saiu no período."
          />
          <StatTile
            icon={Scale}
            label="Resultado do período"
            value={formatBRL(caixa.resultado, { compacto: true })}
            hint="recebido − pago"
            accent={caixa.resultado >= 0 ? "volt" : "magenta"}
            ajuda="Receita recebida menos despesa paga, dentro do período selecionado."
          />
          <StatTile
            icon={Wallet}
            label="Saldo registrado"
            value={formatBRL(saldo.saldo, { compacto: true })}
            hint={
              saldo.desde
                ? `desde ${new Date(saldo.desde + "T00:00:00").toLocaleDateString("pt-BR")}`
                : "no GestAcad"
            }
            accent="cyan"
            ajuda="Saldo calculado com os lançamentos conhecidos pelo GestAcad. Não é o saldo da sua conta bancária."
          />
        </div>
      </section>

      {/* ---------- B. Contas em aberto ---------- */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
          Contas em aberto
          <Ajuda texto="Tudo que ainda não foi pago, independente do período escolhido: uma dívida antiga continua em aberto hoje. Canceladas não entram." />
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            icon={ArrowUpCircle}
            label="Vencido a receber"
            value={formatBRL(aReceber.vencido, { compacto: true })}
            hint={`${aReceber.qtdVencido} cobrança(s)`}
            accent={aReceber.vencido > 0 ? "magenta" : "slate"}
            ajuda="Cobranças pendentes cujo vencimento já passou."
          />
          <StatTile
            icon={ArrowUpCircle}
            label="Futuro a receber"
            value={formatBRL(aReceber.futuro, { compacto: true })}
            hint={`${aReceber.qtdFuturo} a vencer`}
            accent="volt"
            ajuda="Cobranças pendentes que ainda vão vencer."
          />
          <StatTile
            icon={ArrowDownCircle}
            label="Vencido a pagar"
            value={formatBRL(aPagar.vencido, { compacto: true })}
            hint={`${aPagar.qtdVencido} conta(s)`}
            accent={aPagar.vencido > 0 ? "magenta" : "slate"}
            ajuda="Contas suas que já venceram e ainda não foram pagas."
          />
          <StatTile
            icon={ArrowDownCircle}
            label="Futuro a pagar"
            value={formatBRL(aPagar.futuro, { compacto: true })}
            hint={`${aPagar.qtdFuturo} a vencer`}
            accent="amber"
            ajuda="Contas suas que ainda vão vencer."
          />
          <StatTile
            icon={TrendingUp}
            label="Saldo projetado"
            value={formatBRL(projecao.projetado, { compacto: true })}
            hint="se tudo for pago"
            accent={projecao.projetado >= 0 ? "cyan" : "magenta"}
            ajuda="Saldo registrado + valores a receber − valores a pagar. É uma projeção: depende de todas as pendências serem recebidas e pagas."
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {formatBRL(projecao.saldoRegistrado)} registrado{" "}
          <span className="text-volt-300">+ {formatBRL(projecao.aReceber)}</span> a
          receber{" "}
          <span className="text-magenta-400">− {formatBRL(projecao.aPagar)}</span> a
          pagar =<b className="text-white"> {formatBRL(projecao.projetado)}</b>
        </p>
      </section>

      {/* ---------- C. Análise ---------- */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          Análise
          <Ajuda texto="Visões mais detalhadas: a evolução no tempo, o ponto de partida do saldo e o resultado por competência." />
        </h2>

        <div className="surface rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-volt-300" />
            <h3 className="font-semibold text-white">Entradas e saídas no período</h3>
            <Ajuda texto="As barras mostram o dinheiro que entrou e saiu de fato, pela data de pagamento. A linha tracejada soma a esse resultado o que ainda está pendente com vencimento dentro do período." />
          </div>
          <div className="mt-3">
            <GraficoFinanceiroMensal dados={dadosPeriodo} />
          </div>
        </div>

        <SaldoInicialCard
          slug={params.slug}
          saldoInicial={Number(sessao.academia.saldo_inicial ?? 0)}
          dataSaldoInicial={sessao.academia.data_saldo_inicial ?? null}
          desdeEfetivo={saldo.desde}
        />

        <DREResumo dre={dre} periodo={periodo.label} />
      </section>
    </div>
  );
}
