import Breadcrumbs from "@/components/painel/Breadcrumbs";
import Financeiro from "@/components/painel/Financeiro";
import { requireSessao } from "@/lib/auth";
import { getAlunos, getDespesas, getReceitas } from "@/lib/data";
import { agruparPorMes, calcularKpisFinanceiro, ultimosMeses } from "@/lib/financeiro";

export default async function FinanceiroPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const desde = `${ultimosMeses(6)[0].chave}-01`;

  const [alunos, receitas, despesas] = await Promise.all([
    getAlunos(sessao.academia.id),
    getReceitas(sessao.academia.id, desde),
    getDespesas(sessao.academia.id, desde),
  ]);

  const kpis = calcularKpisFinanceiro(receitas, despesas);
  const dadosMensais = agruparPorMes(receitas, despesas, 6);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Financeiro" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="text-sm text-slate-400">
          Receitas, despesas, lucro e fluxo de caixa da academia.
        </p>
      </div>

      <Financeiro
        slug={params.slug}
        alunos={alunos}
        receitas={receitas}
        despesas={despesas}
        kpis={kpis}
        dadosMensais={dadosMensais}
      />
    </div>
  );
}
