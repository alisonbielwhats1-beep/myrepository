import { ShoppingBag } from "lucide-react";
import LojaProdutos from "@/components/loja/LojaProdutos";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getAcademiaPublica, getProdutosPublicos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AlunoLojaPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  await requireFichaAluno(params.slug, params.token);

  const [academia, produtos] = await Promise.all([
    getAcademiaPublica(params.slug),
    getProdutosPublicos(params.slug),
  ]);

  const whatsappDigits = academia?.whatsapp?.replace(/\D/g, "");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Produtos da academia</p>
        <h1 className="text-2xl font-bold text-white">Loja</h1>
      </header>

      {produtos.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          Nenhum produto disponível no momento.
        </div>
      ) : (
        <LojaProdutos produtos={produtos} whatsappDigits={whatsappDigits} />
      )}
    </div>
  );
}
