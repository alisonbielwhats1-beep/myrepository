import { MessageCircle, ShoppingBag } from "lucide-react";
import ProdutoImagem from "@/components/loja/ProdutoImagem";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getAcademiaPublica, getProdutosPublicos } from "@/lib/data";
import { CATEGORIAS_PRODUTO } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlunoLojaPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  await requireFichaAluno(params.slug, params.alunoId);

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
        <div className="grid grid-cols-2 gap-3">
          {produtos.map((p) => {
            const link = whatsappDigits
              ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                  `Olá! Tenho interesse no produto "${p.nome}" (${formatBRL(p.preco)}).`
                )}`
              : null;
            return (
              <div key={p.id} className="surface flex flex-col overflow-hidden rounded-2xl">
                <ProdutoImagem
                  nome={p.nome}
                  imagemUrl={p.imagem_url}
                  categoria={p.categoria}
                  className="h-32 w-full"
                />
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-sm font-medium text-white">{p.nome}</p>
                  <span className="text-[11px] text-slate-500">
                    {CATEGORIAS_PRODUTO.find((c) => c.value === p.categoria)?.label}
                  </span>
                  {p.descricao && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {p.descricao}
                    </p>
                  )}
                  <p className="mt-2 font-bold text-volt-300">{formatBRL(p.preco)}</p>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost mt-2 w-full !py-2 text-xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Tenho interesse
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
