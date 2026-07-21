"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import {
  deslocar,
  GRANULARIDADES,
  Granularidade,
  Periodo,
} from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Filtro de período: Dia / Semana / Mês / Ano + intervalo personalizado (de/até). */
export default function PeriodoFilter({ periodo }: { periodo: Periodo }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [mostrarIntervalo, setMostrarIntervalo] = useState(periodo.custom);
  const [de, setDe] = useState(periodo.custom ? periodo.inicio : "");
  const [ate, setAte] = useState(periodo.custom ? periodo.fim : "");

  // Navega por granularidade (Dia/Semana/Mês/Ano): limpa o intervalo custom.
  const irGran = (patch: { gran?: Granularidade; ref?: string }) => {
    const p = new URLSearchParams(params.toString());
    p.delete("de");
    p.delete("ate");
    if (patch.gran) p.set("gran", patch.gran);
    if (patch.ref) p.set("ref", patch.ref);
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  };

  const aplicarIntervalo = () => {
    if (!de || !ate) return;
    const p = new URLSearchParams(params.toString());
    p.delete("gran");
    p.delete("ref");
    p.set("de", de);
    p.set("ate", ate);
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  };

  return (
    <div
      className={cn(
        "no-print flex flex-col gap-2 transition-opacity",
        pending && "pointer-events-none opacity-60"
      )}
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Granularidade + botão de intervalo */}
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1">
          {GRANULARIDADES.map((g) => (
            <button
              key={g.valor}
              onClick={() =>
                irGran({ gran: g.valor, ref: periodo.custom ? undefined : periodo.ref })
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                !periodo.custom && periodo.gran === g.valor
                  ? "bg-volt-300 text-ink-950"
                  : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
              )}
            >
              {g.label}
            </button>
          ))}
          <button
            onClick={() => setMostrarIntervalo((v) => !v)}
            title="Intervalo personalizado"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
              periodo.custom
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
            )}
          >
            <CalendarRange className="h-4 w-4" />
            Intervalo
          </button>
        </div>

        {/* Navegação anterior/seguinte (só nas granularidades fixas) */}
        {!periodo.custom ? (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => irGran({ ref: deslocar(periodo, -1) })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700"
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-white">
              {periodo.label}
            </span>
            <button
              onClick={() => irGran({ ref: deslocar(periodo, 1) })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700"
              aria-label="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-white">{periodo.label}</span>
        )}
      </div>

      {/* Inputs do intervalo personalizado */}
      {mostrarIntervalo && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-ink-600 bg-ink-800 p-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">De</span>
            <input
              type="date"
              value={de}
              max={ate || undefined}
              onChange={(e) => setDe(e.target.value)}
              className="inp !py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">Até</span>
            <input
              type="date"
              value={ate}
              min={de || undefined}
              onChange={(e) => setAte(e.target.value)}
              className="inp !py-1.5 text-xs"
            />
          </label>
          <button
            onClick={aplicarIntervalo}
            disabled={!de || !ate}
            className="btn-volt !py-2 text-xs disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
