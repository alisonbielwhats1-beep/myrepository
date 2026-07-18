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
  searchParams: { gran?: string; ref?: string };
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
      <ReceitasView slug={params.slug} alunos={alunos} receitas={receitas} />
    </div>
  );
}
