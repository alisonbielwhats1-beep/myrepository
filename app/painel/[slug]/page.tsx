import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
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
import Ajuda from "@/components/ui/Ajuda";
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
import RepassesEstimadosCard from "@/components/painel/RepassesEstimadosCard";
import PrimeirosPassos from "@/components/painel/PrimeirosPassos";
import { requireSessao } from "@/lib/auth";
import {
  getRetencaoAlunos,
  getReceitas,
  getDespesas,
  getReceitasJanela,
  getDespesasJanela,
  getContagemAlunos,
  getTelefonesDosAlunos,
  getContagemAlunosCriadosEntre,
  getEvolucaoAlunosContagem,
  getMensalidadesVencidas,
  getProximosVencimentos,
  getFuncionarios,
  getRepassesParceirosFinanceiro,
  getProgressoOnboarding,
} from "@/lib/data";
import { agruparFinanceiro, calcularCaixaPeriodo, ultimosMeses } from "@/lib/financeiro";
import { resolverJanelaDashboard } from "@/lib/periodo";
import {
  classificarRetencao,
  cn,
  configRetencaoDe,
  formatBRL,
  hojeSaoPaulo,
} from "@/lib/utils";
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
  // Repasses estimados de parceiros (TotalPass/Gympass): exclusivo do dono,
  // mesmo critério de Integrações/Financeiro (migration 049) — mais estrito
  // que verFinanceiro, que também libera gerente.
  const verDono = sessao.papel === "dono";

  // Vencimento sempre comparado em America/Sao_Paulo, igual à ficha do aluno,
  // às notificações e à decisão de acesso da recepção.
  const hojeIso = hojeSaoPaulo();
  const em14dias = new Date(`${hojeIso}T00:00:00Z`);
  em14dias.setUTCDate(em14dias.getUTCDate() + 14);
  const em14diasIso = em14dias.toISOString().slice(0, 10);

  // Período anterior (mesma duração, imediatamente antes) para o comparativo.
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

  // Mês atual (mesma referência que o código já usava: UTC via toISOString()).
  const mesAtualChave = new Date().toISOString().slice(0, 7);
  const [mesAno, mesNum] = mesAtualChave.split("-").map(Number);
  const mesIni = `${mesAtualChave}-01`;
  const mesFim = new Date(Date.UTC(mesAno, mesNum, 0)).toISOString().slice(0, 10);

  // Cortes mensais para "Evolução de alunos": o primeiro dia do mês SEGUINTE,
  // usado como limite exclusivo (< corte) — equivale a "até o fim deste mês".
  //
  // Não dá para usar `${chave}-31` como teto: enquanto isso era comparação de
  // string em memória, "2026-02-31" funcionava como sentinela; agora o valor
  // vai para o Postgres como literal de data e 31 de fevereiro/abril/junho
  // não existe — o banco recusa com "date/time field value out of range" e
  // derruba a página. Date.UTC também cuida da virada de dezembro.
  const cortesEvolucao = ultimosMeses(6).map(({ chave }) => {
    const [ano, mes] = chave.split("-").map(Number);
    return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  });

  // Fase 13: nada de carregar a base inteira de alunos/receitas/despesas para
  // somar em memória. Cada consulta abaixo já vem do banco recortada pelo
  // período que ela realmente precisa (ver comentários em lib/data.ts).
  const [
    contagemAlunos,
    funcionarios,
    receitasJanela,
    despesasJanela,
    receitasAnt,
    despesasAnt,
    receitasMes,
    novosAlunosCount,
    novosAlunosAntCount,
    evolucaoCounts,
    retencao,
    vencidas,
    proximosVencimentosRows,
    repassesParceiros,
  ] = await Promise.all([
    getContagemAlunos(sessao.academia.id),
    verFinanceiro ? getFuncionarios(sessao.academia.id) : Promise.resolve([]),
    verFinanceiro ? getReceitasJanela(sessao.academia.id, janela.desde, janela.ate) : Promise.resolve([]),
    verFinanceiro ? getDespesasJanela(sessao.academia.id, janela.desde, janela.ate) : Promise.resolve([]),
    verFinanceiro ? getReceitas(sessao.academia.id, antDesde, antAte) : Promise.resolve([]),
    verFinanceiro ? getDespesas(sessao.academia.id, antDesde, antAte) : Promise.resolve([]),
    verFinanceiro ? getReceitasJanela(sessao.academia.id, mesIni, mesFim) : Promise.resolve([]),
    getContagemAlunosCriadosEntre(sessao.academia.id, janela.desde, janela.ate),
    getContagemAlunosCriadosEntre(sessao.academia.id, antDesde, antAte),
    getEvolucaoAlunosContagem(sessao.academia.id, cortesEvolucao),
    getRetencaoAlunos(),
    verFinanceiro ? getMensalidadesVencidas(sessao.academia.id, hojeIso) : Promise.resolve([]),
    verFinanceiro
      ? getProximosVencimentos(sessao.academia.id, hojeIso, em14diasIso, 8)
      : Promise.resolve([]),
    // Exclusivo do dono (verDono, não verFinanceiro): quem não é dono nunca
    // chama a RPC, e o payload da página nunca carrega esses valores para
    // gerente/recepção/instrutor. A RPC repasses_parceiros_resumo também se
    // protege por dentro (migration 049) — dupla trava.
    verDono ? getRepassesParceirosFinanceiro(janela.desde, janela.ate) : Promise.resolve([]),
  ]);

  // Mesma consulta agregada e mesma função de classificação da tela de Retenção.
  // O card "Alunos sumidos" conta somente a classificação "sumido".
  const configRetencao = configRetencaoDe(sessao.academia);
  const sumidos = retencao
    .map((r) => {
      const c = classificarRetencao(
        { criado_em: r.criado_em, status_matricula: "ativa" },
        r.ultimo_acesso,
        configRetencao
      );
      return c ? { linha: r, ...c } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((x) => x.classificacao === "sumido")
    .map((x) => ({
      alunoId: x.linha.aluno_id,
      nome: x.linha.nome,
      ultimoAcesso: x.ultimoAcesso,
      explicacao: x.explicacao,
      diasSemAcesso: x.diasSemAcesso,
    }));

  // Telefones só dos sumidos que o painel realmente exibe (o card corta em 8),
  // para o botão de reativação por WhatsApp. A RPC de retenção não devolve
  // telefone e não vale alterá-la só por isso.
  const sumidosExibidos = sumidos.slice(0, 8);
  const telefonesSumidos = await getTelefonesDosAlunos(
    sessao.academia.id,
    sumidosExibidos.map((s) => s.alunoId)
  );
  const sumidosComContato = sumidosExibidos.map((s) => ({
    ...s,
    telefone: telefonesSumidos.get(s.alunoId) ?? null,
  }));

  const totalAlunos = contagemAlunos.total;
  const alunosAtivos = contagemAlunos.ativos;
  const funcionariosAtivos = funcionarios.filter((f) => f.status === "ativo").length;

  // ---- Inadimplência (só para quem vê financeiro) ----
  const inadimplentes: AlertaInadimplente[] = [];
  const proximosVencimentos = proximosVencimentosRows;
  // Recorte de "vence hoje" dentro dos próximos vencimentos já buscados —
  // alimenta só a barra de "Ações de hoje" (nenhuma consulta nova).
  const venceHojeCount = proximosVencimentos.filter((r) => r.data === hojeIso).length;

  if (verFinanceiro) {
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
          nome: r.aluno?.nome ?? "Aluno",
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
  }

  // ---- KPIs financeiros (só para quem vê financeiro) ----
  // Regime de caixa (status=pago + data_pagamento no período), igual ao
  // Financeiro e ao gráfico "Receita x Despesa" logo abaixo — antes este
  // resumo filtrava por vencimento (`data`), então uma mensalidade paga hoje
  // com vencimento mais adiante no mês ficava fora da janela e mostrava R$0.
  const { receitaRecebida: receitaPeriodo, despesaPaga: despesaPeriodo, resultado: lucroPeriodo } =
    verFinanceiro
      ? calcularCaixaPeriodo(receitasJanela, despesasJanela, janela.desde, janela.ate)
      : { receitaRecebida: 0, despesaPaga: 0, resultado: 0 };
  const novosAlunos = novosAlunosCount;

  const somaPagos = (arr: { status: string; valor: number | string }[]) =>
    arr.filter((x) => x.status === "pago").reduce((a, x) => a + Number(x.valor), 0);
  const receitaAnt = verFinanceiro ? somaPagos(receitasAnt) : 0;
  const despesaAnt = verFinanceiro ? somaPagos(despesasAnt) : 0;
  const lucroAnt = receitaAnt - despesaAnt;
  const novosAlunosAnt = novosAlunosAntCount;

  // Variação % entre atual e anterior (evita divisão por zero).
  const variacao = (atual: number, anterior: number): number =>
    anterior === 0 ? (atual === 0 ? 0 : 100) : ((atual - anterior) / Math.abs(anterior)) * 100;

  const financeiroHref = `/painel/${params.slug}/financeiro`;

  // ---- Meta de faturamento do mês (recebido vs meta) + projeção ----
  // Sempre o mês corrente (mesIni..mesFim), independente do filtro do topo.
  // "Recebido" é regime de caixa (status=pago + data_pagamento no mês) — mesmo
  // critério do resumo acima. Antes somava por vencimento (`data`) no mês, o
  // que confundia "cobrança devida este mês" com "dinheiro recebido este mês"
  // (ex.: atraso de mês anterior pago agora não entrava; vencimento futuro já
  // pago entrava mesmo sem o dinheiro ainda ter chegado neste mês).
  const metaMensal = Number(sessao.academia.meta_faturamento_mensal ?? 0);
  const recebidoMes = verFinanceiro
    ? calcularCaixaPeriodo(receitasMes, [], mesIni, mesFim).receitaRecebida
    : 0;
  // Projeção do mês = já recebido (caixa) + o que ainda está pendente com
  // vencimento este mês (competência).
  const projecaoMes = verFinanceiro
    ? recebidoMes +
      receitasMes
        .filter((r) => r.status === "pendente" && r.data >= mesIni && r.data <= mesFim)
        .reduce((a, r) => a + Number(r.valor), 0)
    : 0;
  const pctMeta = metaMensal > 0 ? Math.min(100, (recebidoMes / metaMensal) * 100) : 0;
  const pctProjecao = metaMensal > 0 ? Math.min(100, (projecaoMes / metaMensal) * 100) : 0;
  const mostrarMeta = verFinanceiro && metaMensal > 0;

  const dadosFinanceiro = verFinanceiro
    ? agruparFinanceiro(receitasJanela, despesasJanela, janela.desde, janela.ate)
    : [];

  const hintPeriodo = janela.custom ? "no período" : janela.label.toLowerCase();

  const evolucaoAlunos: PontoEvolucaoAlunos[] = ultimosMeses(6).map(({ label }, i) => ({
    mes: label,
    alunos: evolucaoCounts[i] ?? 0,
  }));

  // Checklist "Primeiros passos": só o dono, e só três counts baratos. O card
  // some sozinho quando plano+aluno+treino estão feitos, então não pesa numa
  // academia já configurada (ainda assim é uma consulta leve).
  const progressoOnboarding = verDono
    ? await getProgressoOnboarding(sessao.academia.id)
    : null;

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

      {/* Ações de hoje — resumo de 1 linha antes dos números frios, montado só
          com o que já foi buscado acima (nenhuma consulta nova). Pedido da
          auditoria visual: dar uma resposta rápida a "o que preciso fazer
          hoje" antes de qualquer gráfico ou card. */}
      {(verFinanceiro || sumidos.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-700 bg-ink-800/40 px-4 py-3 text-sm">
          <span className="font-medium text-slate-300">Hoje</span>
          {verFinanceiro && venceHojeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <CalendarClock className="h-3.5 w-3.5" />
              {venceHojeCount} cobrança{venceHojeCount > 1 ? "s" : ""} vence
              {venceHojeCount > 1 ? "m" : ""} hoje
            </span>
          )}
          {verFinanceiro && inadimplentes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {inadimplentes.length} inadimplente{inadimplentes.length > 1 ? "s" : ""}
            </span>
          )}
          {sumidos.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-magenta-400">
              <UserX className="h-3.5 w-3.5" />
              {sumidos.length} aluno{sumidos.length > 1 ? "s" : ""} sumido
              {sumidos.length > 1 ? "s" : ""}
            </span>
          )}
          {venceHojeCount === 0 && inadimplentes.length === 0 && sumidos.length === 0 && (
            <span className="text-slate-500">Nada pendente por aqui. 🎉</span>
          )}
        </div>
      )}

      {/* Primeiros passos (só o dono; some sozinho quando concluído). */}
      {progressoOnboarding && (
        <PrimeirosPassos slug={params.slug} progresso={progressoOnboarding} />
      )}

      {/* KPIs — linha 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Alunos"
          value={String(totalAlunos)}
          hint={`${alunosAtivos} ativos`}
          accent="volt"
        />
        <StatTile
          icon={UserPlus}
          label="Novos alunos"
          value={String(novosAlunos)}
          hint={hintPeriodo}
          accent="cyan"
          delta={{ pct: variacao(novosAlunos, novosAlunosAnt) }}
        />
        <StatTile
          icon={UserX}
          label="Alunos sumidos"
          value={String(sumidos.length)}
          hint={`sem acesso há ${configRetencao.diasSumido}+ dias`}
          accent={sumidos.length > 0 ? "magenta" : "slate"}
        />
        {verFinanceiro && (
          <StatTile
            icon={UserRound}
            label="Funcionários"
            value={String(funcionariosAtivos)}
            hint={`${funcionarios.length} cadastrados`}
            accent="cyan"
          />
        )}
      </div>

      {/* Mini resumo financeiro — o detalhe mora no módulo Financeiro */}
      {verFinanceiro && (
        <div className="surface rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <DollarSign className="h-4 w-4 text-volt-300" />
              <h2 className="font-semibold text-white">Resumo financeiro</h2>
              <span className="text-xs text-slate-500">{hintPeriodo}</span>
            </div>
            <Link href={financeiroHref} className="btn-ghost">
              Ver Financeiro completo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <p className="label-muted">Receita</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-volt-300 [overflow-wrap:anywhere] sm:text-2xl">
                {formatBRL(receitaPeriodo, { compacto: true })}
              </p>
            </div>
            <div>
              <p className="label-muted">Despesa</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-red-400 [overflow-wrap:anywhere] sm:text-2xl">
                {formatBRL(despesaPeriodo, { compacto: true })}
              </p>
            </div>
            <div>
              <p className="label-muted">Resultado</p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums [overflow-wrap:anywhere] sm:text-2xl",
                  lucroPeriodo >= 0 ? "text-white" : "text-red-400"
                )}
              >
                {formatBRL(lucroPeriodo, { compacto: true })}
              </p>
            </div>
            <div>
              <p className="label-muted">Inadimplentes</p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums sm:text-2xl",
                  inadimplentes.length > 0 ? "text-red-400" : "text-slate-400"
                )}
              >
                {inadimplentes.length}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">com mensalidade vencida</p>
            </div>
          </div>
        </div>
      )}

      {/* Meta de faturamento do mês */}
      {mostrarMeta && (
        <div className="surface rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Target className="h-4 w-4 text-volt-300" />
              <h2 className="font-semibold text-white">Meta de faturamento do mês</h2>
              <Ajuda texto="Sempre o mês corrente, em regime de caixa — independente do período escolhido no filtro do Dashboard acima. Por isso pode diferir do Resumo financeiro quando o filtro ali não cobrir o mês inteiro (ex.: filtro em 'Hoje')." />
            </div>
            <span className="text-xs text-slate-500">{Math.round(pctMeta)}% da meta</span>
          </div>

          {/* Três números separados de propósito — "R$X de R$Y" escondia se o
              valor recebido já incluía pendente ou não. */}
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div>
              <p className="label-muted">Recebido no mês</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-volt-300 [overflow-wrap:anywhere] sm:text-2xl">
                {formatBRL(recebidoMes, { compacto: true })}
              </p>
            </div>
            <div>
              <p className="label-muted">Projeção do mês</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-white [overflow-wrap:anywhere] sm:text-2xl">
                {formatBRL(projecaoMes, { compacto: true })}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">recebido + a receber</p>
            </div>
            <div>
              <p className="label-muted">Meta do mês</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-300 [overflow-wrap:anywhere] sm:text-2xl">
                {formatBRL(metaMensal, { compacto: true })}
              </p>
            </div>
          </div>

          {/* Barra: recebido (sólido) + projeção (translúcido) */}
          <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-ink-700">
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

      {/* Repasses estimados — exclusivo do dono, separado de Receita/Caixa/
          Lucro/Saldo/Meta acima. Mesma RPC e mesmo período do Financeiro. */}
      {verDono && (
        <RepassesEstimadosCard
          slug={params.slug}
          linhas={repassesParceiros}
          hintPeriodo={hintPeriodo}
        />
      )}

      {/* Alertas */}
      <AlertasPainel
        slug={params.slug}
        inadimplentes={inadimplentes}
        sumidos={sumidosComContato}
        academiaNome={sessao.academia.nome_fantasia}
        isDemo={sessao.academia.is_demo}
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
                          isDemo={sessao.academia.is_demo}
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

      {/* PLG: teaser de recursos bloqueados para plano Básico.
          Fica recolhido por padrão (<details>, sem JS) — a auditoria visual
          apontou que misturar oferta comercial com dados operacionais reais
          (aluno sumiu, inadimplência) no meio da rolagem cria uma quebra de
          contexto. O aviso continua visível, só o conteúdo promocional espera
          o clique. */}
      {!planoPodeAcessar(sessao.academia.plano_saas, "financeiro") && (
        <details className="surface group rounded-2xl border border-volt-500/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-volt-400" />
              <h2 className="font-semibold text-white">Libere mais recursos</h2>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              Upgrade para o Profissional (R$ 59,90/mês) e desbloqueie:
            </p>
            <Link
              href={`/painel/${params.slug}/configuracoes#plano`}
              className="btn-volt text-xs"
            >
              Ver planos
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { icon: DollarSign, label: "Financeiro", desc: "Receitas, despesas e DRE" },
              { icon: HeartPulse, label: "Retenção", desc: `${sumidos.length} aluno(s) sumido(s)` },
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
        </details>
      )}
    </div>
  );
}
