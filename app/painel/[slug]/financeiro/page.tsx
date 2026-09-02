import Link from "next/link";
import Ajuda from "@/components/ui/Ajuda";
import ResumoCaixaCompetencia from "@/components/painel/financeiro/ResumoCaixaCompetencia";
import AvisoLancamentosSemData from "@/components/painel/financeiro/AvisoLancamentosSemData";
import DREResumo from "@/components/painel/financeiro/DREResumo";
import FormasPagamentoCard from "@/components/painel/financeiro/FormasPagamentoCard";
import GraficoFinanceiro from "@/components/painel/financeiro/GraficoFinanceiro";
import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import RepassesParceirosCard from "@/components/painel/financeiro/RepassesParceirosCard";
import SaldoInicialCard from "@/components/painel/financeiro/SaldoInicialCard";
import UpgradeGuard from "@/components/ui/UpgradeGuard";
import { requireSessao } from "@/lib/auth";
import {
  getDreFinanceiro,
  getFormasPagamentoFinanceiro,
  getRepassesParceirosFinanceiro,
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
import { cn, formatBRL } from "@/lib/utils";
import { planoPodeAcessar, planoMinimo } from "@/lib/planos";

export const dynamic = "force-dynamic";

export default async function FinanceiroOverviewPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: {
    gran?: string; ref?: string; de?: string; ate?: string; periodo?: string;
  };
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

  const [resumo, linhasDre, serie, formasPagamento, repasses] = await Promise.all([
    getResumoFinanceiro(periodo.inicio, periodo.fim),
    getDreFinanceiro(periodo.inicio, periodo.fim),
    getSerieFinanceira(periodo.inicio, periodo.fim, diario),
    getFormasPagamentoFinanceiro(periodo.inicio, periodo.fim),
    getRepassesParceirosFinanceiro(periodo.inicio, periodo.fim),
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

      <AvisoLancamentosSemData
        slug={params.slug}
        receitas={incompletos.receitas}
        receitasValor={incompletos.receitasValor}
        despesas={incompletos.despesas}
        despesasValor={incompletos.despesasValor}
      />

      {/* ---------- Caixa × Competência em abas (auditoria de UX, item 7) ----------
          As duas visões que antes conviviam soltas na tela, agora lado a lado
          com uma faixa que liga uma à outra por número. Só apresentação — os
          valores vêm prontos de lib/financeiro. */}
      <ResumoCaixaCompetencia
        periodo={periodo.label}
        receitaRecebida={caixa.receitaRecebida}
        despesaPaga={caixa.despesaPaga}
        resultado={caixa.resultado}
        saldoRegistrado={saldo.saldo}
        saldoDesde={saldo.desde}
        compReceita={dre.totalReceita}
        compRecebida={dre.receitaRecebida}
        compAReceber={dre.receitaAReceber}
        compDespesa={dre.totalDespesa}
        compAPagar={dre.despesaAPagar}
        compLucro={dre.lucro}
        compMargem={dre.margem}
      />

      {/* ---------- O que está em atraso ---------- */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-white">
          O que está em atraso
          <Ajuda texto="Não depende do período escolhido: uma conta de março que ninguém pagou continua em atraso hoje. Cobranças canceladas não entram." />
        </h2>

        <div className="surface grid gap-4 rounded-2xl p-5 sm:grid-cols-3">
          <Link
            href={`/painel/${params.slug}/financeiro/receitas?status=pendente`}
            className="group"
          >
            <p className="label-muted">Mensalidades vencidas</p>
            <p
              className={cn(
                "mt-1 text-xl font-bold tabular-nums transition group-hover:underline sm:text-2xl",
                aReceber.vencido > 0 ? "text-red-400" : "text-slate-400"
              )}
            >
              {formatBRL(aReceber.vencido, { compacto: true })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {aReceber.qtdVencido} cobrança(s) · {formatBRL(aReceber.futuro, { compacto: true })} ainda a vencer
            </p>
          </Link>

          <Link
            href={`/painel/${params.slug}/financeiro/despesas`}
            className="group"
          >
            <p className="label-muted">Contas vencidas</p>
            <p
              className={cn(
                "mt-1 text-xl font-bold tabular-nums transition group-hover:underline sm:text-2xl",
                aPagar.vencido > 0 ? "text-red-400" : "text-slate-400"
              )}
            >
              {formatBRL(aPagar.vencido, { compacto: true })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {aPagar.qtdVencido} conta(s) · {formatBRL(aPagar.futuro, { compacto: true })} ainda a vencer
            </p>
          </Link>

          <div className="sm:border-l sm:border-ink-700 sm:pl-4">
            <p className="label-muted flex items-center gap-1">
              Saldo projetado
              <Ajuda texto="Saldo registrado + tudo a receber − tudo a pagar. Só chega nesse número se todas as pendências forem realmente pagas." />
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-bold tabular-nums sm:text-2xl",
                projecao.projetado >= 0 ? "text-slate-300" : "text-red-400"
              )}
            >
              {formatBRL(projecao.projetado, { compacto: true })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              se todo mundo pagar em dia
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Análise ---------- */}
      <GraficoFinanceiro dados={dadosPeriodo} periodo={periodo.label} />

      <FormasPagamentoCard linhas={formasPagamento} periodo={periodo.label} />

      <RepassesParceirosCard linhas={repasses} periodo={periodo.label} />

      <DREResumo dre={dre} periodo={periodo.label} />

      <SaldoInicialCard
        slug={params.slug}
        saldoInicial={Number(sessao.academia.saldo_inicial ?? 0)}
        dataSaldoInicial={sessao.academia.data_saldo_inicial ?? null}
        desdeEfetivo={saldo.desde}
      />
    </div>
  );
}
