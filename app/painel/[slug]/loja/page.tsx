import { AlertTriangle } from "lucide-react";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoLoja from "@/components/painel/GestaoLoja";
import RelatorioVendas from "@/components/painel/loja/RelatorioVendas";
import MigracaoPendente from "@/components/painel/MigracaoPendente";
import { requireSecao } from "@/lib/auth";
import { getProdutos, getRelatorioVendas } from "@/lib/data";
import { Produto } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LojaPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "loja");
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  let produtos: Produto[] = [];
  try {
    produtos = await getProdutos(sessao.academia.id);
  } catch {
    return (
      <div className="space-y-6">
        <Breadcrumbs slug={params.slug} items={[{ label: "Loja" }]} />
        <MigracaoPendente arquivo="005_loja_feedback_treinos.sql" recurso="a Loja" />
      </div>
    );
  }

  const vendas = await getRelatorioVendas(sessao.academia.id, desde);

  // Alerta de reposição: produtos com estoque controlado no/abaixo do mínimo.
  const reposicao = produtos.filter(
    (p) => p.estoque != null && p.estoque <= p.estoque_minimo
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Loja" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Loja</h1>
        <p className="text-sm text-slate-400">
          Cadastre os produtos vendidos na academia (suplementos, acessórios,
          vestuário…). Os produtos visíveis aparecem no site público e na tela
          do aluno. Tudo é editável por você.
        </p>
      </div>

      {reposicao.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Reposição necessária ({reposicao.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reposicao.map((p) => (
              <span
                key={p.id}
                className="chip border-amber-500/30 bg-amber-500/10 text-amber-200"
              >
                {p.nome}: {p.estoque}
                {p.estoque === 0 ? " (esgotado)" : ` / mín. ${p.estoque_minimo}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {vendas.qtdVendas > 0 && (
        <RelatorioVendas
          total={vendas.total}
          qtdVendas={vendas.qtdVendas}
          ranking={vendas.ranking}
          periodo="Últimos 30 dias"
        />
      )}

      <GestaoLoja slug={params.slug} produtosIniciais={produtos} />
    </div>
  );
}
