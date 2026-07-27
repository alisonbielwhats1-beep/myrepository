import PeriodoFilter from "@/components/painel/financeiro/PeriodoFilter";
import DespesasView from "@/components/painel/financeiro/DespesasView";
import { requireSessao } from "@/lib/auth";
import { contarDespesas, getDespesas } from "@/lib/data";
import { resolverPeriodo } from "@/lib/periodo";

export const dynamic = "force-dynamic";

// Ver LIMITE_TODOS em financeiro/receitas/page.tsx — mesmo raciocínio, mesmo
// limite, para não deixar a tabela de despesas inviável com periodo=todos.
const LIMITE_TODOS = 1000;

export default async function DespesasPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: {
    gran?: string; ref?: string; de?: string; ate?: string; periodo?: string;
    pagamento?: string;
  };
}) {
  const sessao = await requireSessao(params.slug);
  const periodo = resolverPeriodo(searchParams);
  const limite = periodo.todos ? LIMITE_TODOS : undefined;

  const [despesas, total] = await Promise.all([
    getDespesas(sessao.academia.id, periodo.inicio, periodo.fim, limite),
    periodo.todos
      ? contarDespesas(sessao.academia.id, periodo.inicio, periodo.fim)
      : Promise.resolve(null),
  ]);
  const truncado = total !== null && total > despesas.length;

  // Competência (mês) usada pelo botão "gerar folha": o mês do período atual.
  const competenciaFolha = `${periodo.ref.slice(0, 7)}-01`;

  return (
    <div className="space-y-5">
      <PeriodoFilter periodo={periodo} />
      <DespesasView
        slug={params.slug}
        despesas={despesas}
        totalReal={total ?? despesas.length}
        truncado={truncado}
        competenciaFolha={competenciaFolha}
        pagamentoInicial={searchParams.pagamento}
      />
    </div>
  );
}
