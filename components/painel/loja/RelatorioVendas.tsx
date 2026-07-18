import { Trophy } from "lucide-react";
import { LinhaVenda } from "@/lib/data";
import { formatBRL } from "@/lib/utils";

/** Resumo de vendas da loja: total faturado e ranking de mais vendidos. */
export default function RelatorioVendas({
  total,
  qtdVendas,
  ranking,
  periodo,
}: {
  total: number;
  qtdVendas: number;
  ranking: LinhaVenda[];
  periodo: string;
}) {
  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-volt-300" />
        <h2 className="font-semibold text-white">Vendas da loja</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">{periodo}</p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="label-muted">Faturado</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-volt-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(total)}
          </p>
        </div>
        <div>
          <p className="label-muted">Vendas</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white sm:text-2xl">
            {qtdVendas}
          </p>
        </div>
      </div>

      {ranking.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Mais vendidos
          </p>
          <ul className="space-y-1.5">
            {ranking.slice(0, 5).map((l, i) => (
              <li
                key={l.produtoId ?? l.nome}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-ink-700 text-[11px] font-bold text-slate-300">
                    {i + 1}
                  </span>
                  <span className="truncate text-slate-300">{l.nome}</span>
                </span>
                <span className="flex-none tabular-nums text-slate-400">
                  {l.vendas}x · {formatBRL(l.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
