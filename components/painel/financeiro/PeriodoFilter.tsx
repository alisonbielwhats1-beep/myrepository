"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  deslocar,
  GRANULARIDADES,
  Granularidade,
  Periodo,
} from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Filtro de período por Dia / Semana / Mês / Ano, com navegação anterior/seguinte. */
export default function PeriodoFilter({ periodo }: { periodo: Periodo }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const ir = (patch: { gran?: Granularidade; ref?: string }) => {
    const p = new URLSearchParams(params.toString());
    if (patch.gran) p.set("gran", patch.gran);
    if (patch.ref) p.set("ref", patch.ref);
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      {/* Granularidade */}
      <div className="inline-flex gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1">
        {GRANULARIDADES.map((g) => (
          <button
            key={g.valor}
            onClick={() => ir({ gran: g.valor, ref: periodo.ref })}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              periodo.gran === g.valor
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Navegação de período */}
      <div className="inline-flex items-center gap-2">
        <button
          onClick={() => ir({ ref: deslocar(periodo, -1) })}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700"
          aria-label="Período anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-white">
          {periodo.label}
        </span>
        <button
          onClick={() => ir({ ref: deslocar(periodo, 1) })}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700"
          aria-label="Próximo período"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
