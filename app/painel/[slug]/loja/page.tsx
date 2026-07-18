import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoLoja from "@/components/painel/GestaoLoja";
import { requireSessao } from "@/lib/auth";
import { getProdutos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LojaPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const produtos = await getProdutos(sessao.academia.id);

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

      <GestaoLoja slug={params.slug} produtosIniciais={produtos} />
    </div>
  );
}
