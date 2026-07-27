import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import ReceitasView from "@/components/painel/financeiro/ReceitasView";
import { requireSessao } from "@/lib/auth";
import { contarReceitas, getAlunosResumo, getReceitas } from "@/lib/data";
import { resolverPeriodo } from "@/lib/periodo";

export const dynamic = "force-dynamic";

// periodo=todos vira "2000-01-01" até o fim do ano seguinte (lib/periodo.ts)
// — na prática, sem teto. Sem esse limite explícito, uma academia com anos
// de histórico renderizaria milhares de linhas na tabela e no CSV de uma vez
// (Fase 13). O limite é comunicado na tela, não escondido.
const LIMITE_TODOS = 1000;

export default async function ReceitasPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: {
    gran?: string; ref?: string; de?: string; ate?: string; periodo?: string;
    aluno?: string; status?: string; pagamento?: string; tipo?: string; q?: string;
  };
}) {
  const sessao = await requireSessao(params.slug);
  const periodo = resolverPeriodo(searchParams);
  const limite = periodo.todos ? LIMITE_TODOS : undefined;

  const [alunos, receitas, total] = await Promise.all([
    getAlunosResumo(sessao.academia.id),
    getReceitas(sessao.academia.id, periodo.inicio, periodo.fim, limite),
    periodo.todos
      ? contarReceitas(sessao.academia.id, periodo.inicio, periodo.fim)
      : Promise.resolve(null),
  ]);
  const truncado = total !== null && total > receitas.length;

  return (
    <div className="space-y-5">
      <PeriodoFilter periodo={periodo} />
      <ReceitasView
        slug={params.slug}
        alunos={alunos}
        receitas={receitas}
        totalReal={total ?? receitas.length}
        truncado={truncado}
        alunoIdInicial={searchParams.aluno}
        statusInicial={searchParams.status}
        pagamentoInicial={searchParams.pagamento}
        tipoInicial={searchParams.tipo}
        buscaInicial={searchParams.q}
      />
    </div>
  );
}
