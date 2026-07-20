"use client";

import { useState, useTransition } from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { VendaRecente } from "@/lib/data";
import { estornarVenda } from "@/app/painel/[slug]/loja/actions";
import { cn, formatBRL } from "@/lib/utils";

export default function HistoricoVendas({
  slug,
  vendas,
}: {
  slug: string;
  vendas: VendaRecente[];
}) {
  if (vendas.length === 0) return null;

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-slate-400" />
        <h2 className="font-semibold text-white">Histórico de vendas</h2>
        <span className="ml-auto text-xs text-slate-500">(últimas {vendas.length})</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Clique em Estornar para desfazer uma baixa errada — apaga a receita e devolve o estoque.
      </p>

      <ul className="divide-y divide-ink-700/70">
        {vendas.map((v) => (
          <LinhaVenda key={v.id} slug={slug} venda={v} />
        ))}
      </ul>
    </div>
  );
}

function LinhaVenda({ slug, venda }: { slug: string; venda: VendaRecente }) {
  const [pending, startTransition] = useTransition();
  const [estornado, setEstornado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const estornar = () => {
    if (!window.confirm(`Estornar venda "${venda.descricao}"?\nA receita será apagada e o estoque restaurado.`))
      return;
    setErro(null);
    startTransition(async () => {
      try {
        await estornarVenda(slug, venda.id);
        setEstornado(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao estornar.");
      }
    });
  };

  if (estornado) return null;

  const dataFormatada = new Date(venda.data + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <li className={cn("flex items-center gap-3 py-3", pending && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{venda.descricao}</p>
        <p className="text-xs text-slate-500">{dataFormatada}</p>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>
      <span className="flex-none tabular-nums text-sm font-semibold text-volt-300">
        {formatBRL(venda.valor)}
      </span>
      <button
        type="button"
        onClick={estornar}
        disabled={pending}
        title="Estornar esta venda"
        className="flex items-center gap-1 rounded-lg border border-ink-600 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RotateCcw className="h-3 w-3" />
        )}
        Estornar
      </button>
    </li>
  );
}
