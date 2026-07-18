"use client";

import { useState } from "react";
import { Dumbbell, GlassWater, Package, Shirt, Sparkles, Wrench } from "lucide-react";
import { CategoriaProduto } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONE: Record<CategoriaProduto, typeof Package> = {
  suplemento: Sparkles,
  acessorio: Dumbbell,
  vestuario: Shirt,
  bebida: GlassWater,
  equipamento: Wrench,
  outro: Package,
};

/**
 * Imagem de produto com fallback à prova de falhas: se a URL não carregar
 * (link quebrado, host fora do ar), cai num placeholder por categoria — nunca
 * mostra imagem quebrada. Usa <img> nativo (aceita data URL de foto enviada).
 */
export default function ProdutoImagem({
  nome,
  imagemUrl,
  categoria,
  className,
}: {
  nome: string;
  imagemUrl: string | null;
  categoria: CategoriaProduto;
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const Icone = ICONE[categoria] ?? Package;

  if (!imagemUrl || falhou) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-gradient-to-br from-ink-700 to-ink-900",
          className
        )}
      >
        <div className="flex flex-col items-center gap-2 px-3 text-center text-slate-500">
          <Icone className="h-8 w-8 text-volt-300/70" />
          <span className="line-clamp-2 text-[11px] font-medium">{nome}</span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imagemUrl}
      alt={nome}
      onError={() => setFalhou(true)}
      className={cn("media-native object-cover", className)}
    />
  );
}
