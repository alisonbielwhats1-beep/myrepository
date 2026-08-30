"use client";

import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import ProdutoImagem from "@/components/loja/ProdutoImagem";
import type { ProdutoPublico } from "@/lib/types";
import { CATEGORIAS_PRODUTO } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";

/**
 * Grade de produtos da loja com feedback LOCAL no botão (auditoria de UX): ao
 * tocar em "Tenho interesse", o botão vira "Interesse enviado" (verde) na hora
 * — antes de abrir o WhatsApp — e o rodapé conta quantos produtos foram
 * marcados. O interesse é sinalizado só no cliente; a conversa segue no
 * WhatsApp da academia, como já era.
 */
export default function LojaProdutos({
  produtos,
  whatsappDigits,
}: {
  produtos: ProdutoPublico[];
  whatsappDigits?: string;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const linkDe = (p: ProdutoPublico) =>
    whatsappDigits
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
          `Olá! Tenho interesse no produto "${p.nome}" (${formatBRL(p.preco)}).`
        )}`
      : null;

  const marcar = (p: ProdutoPublico, link: string) => {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      proximo.add(p.id);
      return proximo;
    });
    // Abre o WhatsApp logo após o feedback local (mesma ação de antes).
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {produtos.map((p) => {
          const link = linkDe(p);
          const enviado = marcados.has(p.id);
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
                  <button
                    type="button"
                    onClick={() => marcar(p, link)}
                    aria-pressed={enviado}
                    className={cn(
                      "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98]",
                      enviado
                        ? "bg-volt-300/15 text-volt-300"
                        : "border border-ink-600 text-slate-200 hover:border-ink-500 hover:bg-ink-700"
                    )}
                  >
                    {enviado ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Interesse enviado
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5" /> Tenho interesse
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {marcados.size > 0 && (
        <p className="anim-up text-center text-xs text-slate-500">
          {marcados.size} produto{marcados.size > 1 ? "s" : ""} marcado
          {marcados.size > 1 ? "s" : ""} — a academia continua a conversa no WhatsApp.
        </p>
      )}
    </div>
  );
}
