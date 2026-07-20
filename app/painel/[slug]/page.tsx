import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  DollarSign,
  Scale,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  UserX,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import DashboardRangeFilter from "@/components/painel/DashboardRangeFilter";
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
    getFuncionarios(sessao.academia.id),
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
      } else {
        inadimplentesMap.set(r.aluno_id, {
          alunoId: r.aluno_id,
          nome: r.aluno?.nome ?? nomePorAlunoId.get(r.aluno_id) ?? "Aluno",
          valorTotal: Number(r.valor),
          diasAtraso,
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
        <StatTile
          icon={UserRound}
          label="Funcionários"
          value={String(funcionariosAtivos)}
          hint={`${funcionarios.length} cadastrados`}
          accent="cyan"
        />
        {verFinanceiro ? (
          <StatTile
            icon={Scale}
            label="Lucro no período"
            value={formatBRL(lucroPeriodo, { compacto: true })}
            hint={hintPeriodo}
            accent={lucroPeriodo >= 0 ? "volt" : "magenta"}
          />
        ) : (
          <StatTile
            icon={UserPlus}
            label="Novos alunos"
            value={String(novosAlunos)}
            hint={hintPeriodo}
            accent="cyan"
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
          />
          <StatTile
            icon={TrendingUp}
            label="Despesa no período"
            value={formatBRL(despesaPeriodo, { compacto: true })}
            hint="pago"
            accent="magenta"
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

      {/* Alertas */}
      <AlertasPainel slug={params.slug} inadimplentes={inadimplentes} sumidos={sumidos} />

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
                  <li key={r.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {r.aluno?.nome ?? r.descricao}
                      </p>
                      <p className="text-xs text-slate-500">
                        vence em{" "}
                        {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="font-semibold text-amber-300">
                      {formatBRL(r.valor)}
                    </span>
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
    </div>
  );
}
