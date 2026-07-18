import { FileText } from "lucide-react";
import { DRE } from "@/lib/financeiro";
import {
  CATEGORIAS_DESPESA,
  TIPOS_RECEITA,
} from "@/lib/types";
import { formatBRL } from "@/lib/utils";

/** Demonstrativo simples: receita por tipo x despesa por categoria + lucro. */
export default function DREResumo({ dre, periodo }: { dre: DRE; periodo: string }) {
  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-volt-300" />
        <h2 className="font-semibold text-white">Resultado (DRE)</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">{periodo}, valores pagos</p>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Receitas por tipo */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-volt-300">
            Receitas
          </p>
          {dre.receitasPorTipo.length === 0 ? (
            <p className="text-sm text-slate-500">Sem receitas no período.</p>
          ) : (
            <ul className="space-y-1.5">
              {dre.receitasPorTipo.map((l) => (
                <li key={l.chave} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-300">
                    {TIPOS_RECEITA.find((t) => t.value === l.chave)?.label ?? l.chave}
                  </span>
                  <span className="tabular-nums font-medium text-white">
                    {formatBRL(l.total)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-t border-ink-700 pt-1.5 text-sm font-semibold">
                <span className="text-slate-200">Total</span>
                <span className="tabular-nums text-volt-300">
                  {formatBRL(dre.totalReceita)}
                </span>
              </li>
            </ul>
          )}
        </div>

        {/* Despesas por categoria */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-magenta-400">
            Despesas
          </p>
          {dre.despesasPorCategoria.length === 0 ? (
            <p className="text-sm text-slate-500">Sem despesas no período.</p>
          ) : (
            <ul className="space-y-1.5">
              {dre.despesasPorCategoria.map((l) => (
                <li key={l.chave} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-300">
                    {CATEGORIAS_DESPESA.find((c) => c.value === l.chave)?.label ?? l.chave}
                  </span>
                  <span className="tabular-nums font-medium text-white">
                    {formatBRL(l.total)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-t border-ink-700 pt-1.5 text-sm font-semibold">
                <span className="text-slate-200">Total</span>
                <span className="tabular-nums text-magenta-400">
                  {formatBRL(dre.totalDespesa)}
                </span>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* Lucro / margem */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-900/40 p-4">
        <span className="text-sm font-medium text-slate-300">
          Lucro do período
        </span>
        <div className="flex items-baseline gap-3">
          <span
            className={cnLucro(dre.lucro)}
          >
            {formatBRL(dre.lucro)}
          </span>
          <span className="text-xs text-slate-500">
            margem {dre.margem.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function cnLucro(lucro: number): string {
  return `tabular-nums text-xl font-bold ${
    lucro >= 0 ? "text-volt-300" : "text-magenta-400"
  }`;
}
