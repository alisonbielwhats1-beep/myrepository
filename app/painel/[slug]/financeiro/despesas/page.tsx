import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import DespesasView from "@/components/painel/financeiro/DespesasView";
import { requireSessao } from "@/lib/auth";
import { getDespesas } from "@/lib/data";
import { resolverPeriodo } from "@/lib/periodo";

export const dynamic = "force-dynamic";

export default async function DespesasPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { gran?: string; ref?: string; de?: string; ate?: string };
}) {
  const sessao = await requireSessao(params.slug);
  const periodo = resolverPeriodo(searchParams);
  const despesas = await getDespesas(sessao.academia.id, periodo.inicio, periodo.fim);

  // Competência (mês) usada pelo botão "gerar folha": o mês do período atual.
  const competenciaFolha = `${periodo.ref.slice(0, 7)}-01`;

  return (
    <div className="space-y-5">
      <PeriodoFilter periodo={periodo} />
      <DespesasView
        slug={params.slug}
        despesas={despesas}
        competenciaFolha={competenciaFolha}
      />
    </div>
  );
}
