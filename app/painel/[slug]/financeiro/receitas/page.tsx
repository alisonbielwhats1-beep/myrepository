import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import ReceitasView from "@/components/painel/financeiro/ReceitasView";
import { requireSessao } from "@/lib/auth";
import { getAlunos, getReceitas } from "@/lib/data";
import { resolverPeriodo } from "@/lib/periodo";

export const dynamic = "force-dynamic";

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

  const [alunos, receitas] = await Promise.all([
    getAlunos(sessao.academia.id),
    getReceitas(sessao.academia.id, periodo.inicio, periodo.fim),
  ]);

  return (
    <div className="space-y-5">
      <PeriodoFilter periodo={periodo} />
      <ReceitasView
        slug={params.slug}
        alunos={alunos}
        receitas={receitas}
        alunoIdInicial={searchParams.aluno}
        statusInicial={searchParams.status}
        pagamentoInicial={searchParams.pagamento}
        tipoInicial={searchParams.tipo}
        buscaInicial={searchParams.q}
      />
    </div>
  );
}
