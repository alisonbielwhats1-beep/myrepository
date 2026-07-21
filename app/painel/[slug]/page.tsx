import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  DollarSign,
  HeartPulse,
  Lock,
  Scale,
  Target,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  UserX,
  Zap,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import DashboardRangeFilter from "@/components/painel/DashboardRangeFilter";
import BotaoCobrancaWhats from "@/components/painel/BotaoCobrancaWhats";
import {
  GraficoEvolucaoAlunos,
  GraficoFinanceiroMensal,
  PontoEvolucaoAlunos,
} from "@/components/painel/DashboardCharts";
import AlertasPainel, {
  AlertaInadimplente,
} from "@/components/painel/AlertasPainel";
import { requireSessao } from "@/lib/auth";
import {
  getAlunos,
  getAlunosSumidos,
  getDespesas,
  getFuncionarios,
  getReceitas,
} from "@/lib/data";
import { agruparFinanceiro, ultimosMeses } from "@/lib/financeiro";
import { resolverJanelaDashboard } from "@/lib/periodo";
import { formatBRL } from "@/lib/utils";
import { planoPodeAcessar } from "@/lib/planos";

export default async function DashboardOverviewPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { range?: string; de?: string; ate?: string };
}) {
  const sessao = await requireSessao(params.slug);
  const janela = resolverJanelaDashboard(searchParams);

  // Dono e gerente veem dados financeiros; recepção e instrutor não.
  const verFinanceiro = sessao.papel === "dono" || sessao.papel === "gerente";

  const [alunos, funcionarios, receitas, despesas, sumidos] = await Promise.all([
    getAlunos(sessao.academia.id),
    verFinanceiro ? getFuncionarios(sessao.academia.id) : Promise.resolve([]),
    verFinanceiro ? getReceitas(sessao.academia.id) : Promise.resolve([]),
    verFinanceiro ? getDespesas(sessao.academia.id) : Promise.resolve([]),
    getAlunosSumidos(sessao.academia.id, 14),
  ]);

  const hojeIso = new Date().toISOString().slice(0, 10);
  const em14dias = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const nomePorAlunoId = new Map(alunos.map((a) => [a.id, a.nome]));
  const alunosAtivos = alunos.filter((a) => a.status_matricula === "ativa").length;
  const funcionariosAtivos = funcionarios.filter((f) => f.status === "ativo").length;

  // ---- Inadimplência (só para quem vê financeiro) ----
  const inadimplentes: AlertaInadimplente[] = [];
  const proximosVencimentos: typeof receitas = [];

  if (verFinanceiro) {
    const vencidas = receitas.filter(
      (r) => r.tipo === "mensalidade" && r.status === "pendente" && r.data < hojeIso
    );
    const inadimplentesMap = new Map<string, AlertaInadimplente>();
    for (const r of vencidas) {
      if (!r.aluno_id) continue;
      const diasAtraso = Math.floor(
        (Date.now() - new Date(r.data + "T00:00:00").getTime()) / 86400_000
      );
      const atual = inadimplentesMap.get(r.aluno_id);
      if (atual) {
        atual.valorTotal += Number(r.valor);
        atual.diasAtraso = Math.max(atual.diasAtraso, diasAtraso);
        // Mantém a data de vencimento mais antiga.
        if (!atual.vencimento || r.data < atual.vencimento) atual.vencimento = r.data;
      } else {
        inadimplentesMap.set(r.aluno_id, {
          alunoId: r.aluno_id,
          nome: r.aluno?.nome ?? nomePorAlunoId.get(r.aluno_id) ?? "Aluno",
          valorTotal: Number(r.valor),
          diasAtraso,
          telefone: r.aluno?.telefone ?? null,
          vencimento: r.data,
        });
      }
    }
    inadimplentes.push(
      ...Array.from(inadimplentesMap.values()).sort((a, b) => b.diasAtraso - a.diasAtraso)
    );

    proximosVencimentos.push(
      ...receitas
        .filter((r) => r.status === "pendente" && r.data >= hojeIso && r.data <= em14dias)
        .sort((a, b) => a.data.localeCompare(b.data))
        .slice(0, 8)
    );
  }

  // ---- KPIs financeiros (só para quem vê financeiro) ----
  const noPeriodo = (data: string) => data >= janela.desde && data <= janela.ate;
  const receitaPeriodo = verFinanceiro
    ? receitas.filter((r) => r.status === "pago" && noPeriodo(r.data)).reduce((acc, r) => acc + Number(r.valor), 0)
    : 0;
  const despesaPeriodo = verFinanceiro
    ? despesas.filter((d) => d.status === "pago" && noPeriodo(d.data)).reduce((acc, d) => acc + Number(d.valor), 0)
    : 0;
  const lucroPeriodo = receitaPeriodo - despesaPeriodo;
  const novosAlunos = alunos.filter((a) => noPeriodo(a.criado_em.slice(0, 10))).length;

  // ---- Período anterior (mesma duração, imediatamente antes) para o comparativo ----
  const umDia = 86400_000;
  const spanDias =
    Math.round(
      (new Date(janela.ate + "T00:00:00").getTime() -
        new Date(janela.desde + "T00:00:00").getTime()) /
        umDia
    ) + 1;
  const antAte = new Date(new Date(janela.desde + "T00:00:00").getTime() - umDia)
    .toISOString()
    .slice(0, 10);
  const antDesde = new Date(
    new Date(antAte + "T00:00:00").getTime() - (spanDias - 1) * umDia
  )
    .toISOString()
    .slice(0, 10);
  const noAnterior = (data: string) => data >= antDesde && data <= antAte;
  const somaPagos = (arr: { status: string; valor: number | string }[]) =>
    arr.filter((x) => x.status === "pago").reduce((a, x) => a + Number(x.valor), 0);
  const receitaAnt = verFinanceiro
    ? somaPagos(receitas.filter((r) => noAnterior(r.data)))
    : 0;
  const despesaAnt = verFinanceiro
    ? somaPagos(despesas.filter((d) => noAnterior(d.data)))
    : 0;
  const lucroAnt = receitaAnt - despesaAnt;
  const novosAlunosAnt = alunos.filter((a) => noAnterior(a.criado_em.slice(0, 10))).length;

  // Variação % entre atual e anterior (evita divisão por zero).
  const variacao = (atual: number, anterior: number): number =>
    anterior === 0 ? (atual === 0 ? 0 : 100) : ((atual - anterior) / Math.abs(anterior)) * 100;

  const financeiroHref = `/painel/${params.slug}/financeiro`;

  // ---- Meta de faturamento do mês (recebido vs meta) + projeção ----
  const metaMensal = Number(sessao.academia.meta_faturamento_mensal ?? 0);
  const mesAtualChave = new Date().toISOString().slice(0, 7);
  const noMesAtual = (data: string) => data.slice(0, 7) === mesAtualChave;
  const recebidoMes = verFinanceiro
    ? receitas
        .filter((r) => r.status === "pago" && noMesAtual(r.data))
        .reduce((a, r) => a + Number(r.valor), 0)
    : 0;
  // Projeção do mês = já recebido + o que ainda está pendente para este mês.
  const projecaoMes = verFinanceiro
    ? receitas
        .filter((r) => noMesAtual(r.data))
        .reduce((a, r) => a + Number(r.valor), 0)
    : 0;
  const pctMeta = metaMensal > 0 ? Math.min(100, (recebidoMes / metaMensal) * 100) : 0;
  const pctProjecao = metaMensal > 0 ? Math.min(100, (projecaoMes / metaMensal) * 100) : 0;
  const mostrarMeta = verFinanceiro && metaMensal > 0;

  const dadosFinanceiro = verFinanceiro
    ? agruparFinanceiro(receitas, despesas, janela.desde, janela.ate)
    : [];

  const hintPeriodo = janela.custom ? "no período" : janela.label.toLowerCase();

  const evolucaoAlunos: PontoEvolucaoAlunos[] = ultimosMeses(6).map(
    ({ chave, label }) => {
      const fimDoMes = `${chave}-31`;
      const total = alunos.filter((a) => a.criado_em.slice(0, 10) <= fimDoMes).length;
      return { mes: label, alunos: total };
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">
            Visão geral da {sessao.academia.nome_fantasia}.
          </p>
        </div>
        {verFinanceiro && (
          <DashboardRangeFilter
            range={janela.range}
            desde={janela.desde}
            ate={janela.ate}
            custom={janela.custom}
          />
        )}
      </div>

      {/* KPIs — linha 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Alunos"
          value={String(alunos.length)}
          hint={`${alunosAtivos} ativos`}
          accent="volt"
        />
        {verFinanceiro ? (
          <StatTile
            icon={AlertTriangle}
            label="Inadimplentes"
            value={String(inadimplentes.length)}
            hint="mensalidade vencida"
            accent={inadimplentes.length > 0 ? "magenta" : "slate"}
          />
        ) : (
          <StatTile
            icon={UserX}
            label="Alunos sumidos"
            value={String(sumidos.length)}
            hint="sem acesso há 14+ dias"
            accent={sumidos.length > 0 ? "magenta" : "slate"}
          />
        )}
        {verFinanceiro && (
          <StatTile
            icon={UserRound}
            label="Funcionários"
            value={String(funcionariosAtivos)}
            hint={`${funcionarios.length} cadastrados`}
            accent="cyan"
          />
        )}
        {verFinanceiro ? (
          <StatTile
            icon={Scale}
            label="Lucro no período"
            value={formatBRL(lucroPeriodo, { compacto: true })}
            hint={hintPeriodo}
            accent={lucroPeriodo >= 0 ? "volt" : "magenta"}
            href={financeiroHref}
            delta={{ pct: variacao(lucroPeriodo, lucroAnt) }}
          />
        ) : (
          <StatTile
            icon={UserPlus}
            label="Novos alunos"
            value={String(novosAlunos)}
            hint={hintPeriodo}
            accent="cyan"
            delta={{ pct: variacao(novosAlunos, novosAlunosAnt) }}
          />
        )}
      </div>

      {/* KPIs — linha 2 (só para quem vê financeiro) */}
      {verFinanceiro && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            icon={DollarSign}
            label="Receita no período"
            value={formatBRL(receitaPeriodo, { compacto: true })}
            hint="recebido"
            accent="volt"
            href={financeiroHref}
            delta={{ pct: variacao(receitaPeriodo, receitaAnt) }}
          />
          <StatTile
            icon={TrendingUp}
            label="Despesa no período"
            value={formatBRL(despesaPeriodo, { compacto: true })}
            hint="pago"
            accent="magenta"
            href={financeiroHref}
            delta={{ pct: variacao(despesaPeriodo, despesaAnt), positivoBom: false }}
          />
          <StatTile
            icon={UserPlus}
            label="Novos alunos"
            value={String(novosAlunos)}
            hint={hintPeriodo}
            accent="cyan"
          />
          <StatTile
            icon={UserX}
            label="Alunos sumidos"
            value={String(sumidos.length)}
            hint="sem acesso há 14+ dias"
            accent={sumidos.length > 0 ? "magenta" : "slate"}
          />
        </div>
      )}

      {/* Meta de faturamento do mês */}
      {mostrarMeta && (
        <div className="surface rounded-2xl p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-volt-300" />
              <h2 className="font-semibold text-white">Meta de faturamento do mês</h2>
            </div>
            <p className="text-sm text-slate-400">
              <span className="font-semibold text-white">{formatBRL(recebidoMes)}</span>
              {" "}de {formatBRL(metaMensal)}{" "}
              <span className="text-slate-500">({Math.round(pctMeta)}%)</span>
            </p>
          </div>

          {/* Barra: recebido (sólido) + projeção (translúcido) */}
          <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-volt-500/30"
              style={{ width: `${pctProjecao}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-volt-400"
              style={{ width: `${pctMeta}%` }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-volt-400" /> Recebido
              <span className="ml-3 inline-block h-2 w-2 rounded-full bg-volt-500/40" /> Projeção
              (recebido + a receber): {formatBRL(projecaoMes)}
            </span>
            {recebidoMes >= metaMensal ? (
              <span className="font-semibold text-volt-300">🎉 Meta atingida!</span>
            ) : (
              <span className="text-slate-500">
                Faltam {formatBRL(metaMensal - recebidoMes)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Alertas */}
      <AlertasPainel
        slug={params.slug}
        inadimplentes={inadimplentes}
        sumidos={sumidos}
        academiaNome={sessao.academia.nome_fantasia}
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {verFinanceiro && (
            <div className="surface rounded-2xl p-5">
              <h2 className="font-semibold text-white">Receita x Despesa</h2>
              <p className="mb-2 text-xs text-slate-500">{janela.label}</p>
              <GraficoFinanceiroMensal dados={dadosFinanceiro} />
            </div>
          )}
          <div className="surface rounded-2xl p-5">
            <h2 className="font-semibold text-white">Evolução de alunos</h2>
            <p className="mb-2 text-xs text-slate-500">Total cadastrado por mês</p>
            <GraficoEvolucaoAlunos dados={evolucaoAlunos} />
          </div>
        </div>

        {/* Próximos vencimentos — só para quem vê financeiro */}
        {verFinanceiro && (
          <div className="surface rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-400" />
              <h2 className="font-semibold text-white">Próximos vencimentos</h2>
            </div>
            <p className="mb-3 text-xs text-slate-500">Mensalidades pendentes (14 dias)</p>

            {proximosVencimentos.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nenhum vencimento nos próximos 14 dias.
              </p>
            ) : (
              <ul className="divide-y divide-ink-700/70">
                {proximosVencimentos.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {r.aluno?.nome ?? r.descricao}
                      </p>
                      <p className="text-xs text-slate-500">
                        vence em{" "}
                        {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <span className="font-semibold text-amber-300">
                        {formatBRL(r.valor)}
                      </span>
                      {r.aluno && (
                        <BotaoCobrancaWhats
                          nome={r.aluno.nome}
                          telefone={r.aluno.telefone}
                          academia={sessao.academia.nome_fantasia}
                          valor={formatBRL(r.valor)}
                          data={new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          vencida={false}
                          compacto
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={`/painel/${params.slug}/financeiro`}
              className="btn-ghost mt-4 w-full"
            >
              Ver financeiro completo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* PLG: teaser de recursos bloqueados para plano Básico */}
      {!planoPodeAcessar(sessao.academia.plano_saas, "financeiro") && (
        <div className="surface rounded-2xl border border-volt-500/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-volt-400" />
              <h2 className="font-semibold text-white">Libere mais recursos</h2>
            </div>
            <Link
              href={`/painel/${params.slug}/configuracoes#plano`}
              className="btn-volt text-xs"
            >
              Ver planos
            </Link>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Upgrade para o Profissional (R$ 59,90/mês) e desbloqueie:
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { icon: DollarSign, label: "Financeiro", desc: "Receitas, despesas e DRE" },
              { icon: HeartPulse, label: "Retenção", desc: `${sumidos.length} alunos sumidos esta semana` },
              { icon: UserRound, label: "Equipe", desc: "Adicione recepcionistas e instrutores" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-xl border border-ink-600 bg-ink-800/50 p-3">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-ink-600 bg-ink-700">
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <Lock className="h-3.5 w-3.5 flex-none text-slate-600 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
