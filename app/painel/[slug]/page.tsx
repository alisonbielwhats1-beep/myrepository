import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  DollarSign,
  Scale,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import {
  GraficoEvolucaoAlunos,
  GraficoFinanceiroMensal,
  PontoEvolucaoAlunos,
} from "@/components/painel/DashboardCharts";
import { requireSessao } from "@/lib/auth";
import { getAlunos, getDespesas, getFuncionarios, getReceitas } from "@/lib/data";
import { agruparPorMes, calcularKpisFinanceiro, ultimosMeses } from "@/lib/financeiro";
import { formatBRL } from "@/lib/utils";

export default async function DashboardOverviewPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const janela = ultimosMeses(6);
  const desde = `${janela[0].chave}-01`;

  const [alunos, funcionarios, receitas, despesas] = await Promise.all([
    getAlunos(sessao.academia.id),
    getFuncionarios(sessao.academia.id),
    getReceitas(sessao.academia.id, desde),
    getDespesas(sessao.academia.id, desde),
  ]);

  const hojeIso = new Date().toISOString().slice(0, 10);
  const em14dias = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  const alunosAtivos = alunos.filter((a) => a.status_matricula === "ativa").length;
  const funcionariosAtivos = funcionarios.filter((f) => f.status === "ativo").length;

  const alunosInadimplentes = new Set(
    receitas
      .filter(
        (r) => r.tipo === "mensalidade" && r.status === "pendente" && r.data < hojeIso
      )
      .map((r) => r.aluno_id)
      .filter(Boolean)
  ).size;

  const proximosVencimentos = receitas
    .filter((r) => r.status === "pendente" && r.data >= hojeIso && r.data <= em14dias)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 8);

  const kpis = calcularKpisFinanceiro(receitas, despesas);
  const dadosMensais = agruparPorMes(receitas, despesas, 6);

  // Evolução de alunos: total cadastrado até o fim de cada mês da janela.
  const evolucaoAlunos: PontoEvolucaoAlunos[] = janela.map(({ chave, label }) => {
    const fimDoMes = `${chave}-31`;
    const total = alunos.filter((a) => a.criado_em.slice(0, 10) <= fimDoMes).length;
    return { mes: label, alunos: total };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Visão geral da {sessao.academia.nome_fantasia}.
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Alunos"
          value={String(alunos.length)}
          hint={`${alunosAtivos} ativos`}
          accent="volt"
        />
        <StatTile
          icon={AlertTriangle}
          label="Inadimplentes"
          value={String(alunosInadimplentes)}
          hint="mensalidade vencida"
          accent={alunosInadimplentes > 0 ? "magenta" : "slate"}
        />
        <StatTile
          icon={UserRound}
          label="Funcionários"
          value={String(funcionariosAtivos)}
          hint={`${funcionarios.length} cadastrados`}
          accent="cyan"
        />
        <StatTile
          icon={Scale}
          label="Lucro do mês"
          value={formatBRL(kpis.lucroMes)}
          hint="receita - despesa"
          accent={kpis.lucroMes >= 0 ? "volt" : "magenta"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <StatTile
          icon={DollarSign}
          label="Receita do mês"
          value={formatBRL(kpis.receitaMes)}
          hint="pagas neste mês"
          accent="volt"
        />
        <StatTile
          icon={TrendingUp}
          label="Despesa do mês"
          value={formatBRL(kpis.despesaMes)}
          hint="pagas neste mês"
          accent="magenta"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Gráficos financeiros + evolução de alunos */}
        <div className="space-y-6">
          <div className="surface rounded-2xl p-5">
            <h2 className="font-semibold text-white">Receita x Despesa (mensal)</h2>
            <p className="mb-2 text-xs text-slate-500">Últimos 6 meses</p>
            <GraficoFinanceiroMensal dados={dadosMensais} />
          </div>
          <div className="surface rounded-2xl p-5">
            <h2 className="font-semibold text-white">Evolução de alunos</h2>
            <p className="mb-2 text-xs text-slate-500">Total cadastrado por mês</p>
            <GraficoEvolucaoAlunos dados={evolucaoAlunos} />
          </div>
        </div>

        {/* Próximos vencimentos */}
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
      </div>
    </div>
  );
}
