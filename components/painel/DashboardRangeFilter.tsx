"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { RANGES_DASHBOARD, RangeDashboard } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Filtro do Dashboard: botões fixos + intervalo personalizado (de/até). */
export default function DashboardRangeFilter({
  range,
  desde,
  ate,
  custom,
}: {
  range: RangeDashboard | "custom";
  desde: string;
  ate: string;
  custom: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [mostrarIntervalo, setMostrarIntervalo] = useState(custom);
  const [de, setDe] = useState(desde);
  const [ateLocal, setAte] = useState(ate);

  const irPreset = (valor: RangeDashboard) => {
    startTransition(() => router.push(`${pathname}?range=${valor}`));
  };

  const aplicarIntervalo = () => {
    if (!de || !ateLocal) return;
    startTransition(() => router.push(`${pathname}?de=${de}&ate=${ateLocal}`));
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 transition-opacity sm:items-end",
        pending && "pointer-events-none opacity-60"
      )}
      aria-busy={pending}
    >
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1">
        {RANGES_DASHBOARD.map((r) => (
          <button
            key={r.valor}
            onClick={() => irPreset(r.valor)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              range === r.valor
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
            )}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setMostrarIntervalo((v) => !v)}
          title="Intervalo personalizado"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            custom
              ? "bg-volt-300 text-ink-950"
              : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
          )}
        >
          <CalendarRange className="h-4 w-4" />
          Intervalo
        </button>
      </div>

      {mostrarIntervalo && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-ink-600 bg-ink-800 p-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">De</span>
            <input
              type="date"
              value={de}
              max={ateLocal || undefined}
              onChange={(e) => setDe(e.target.value)}
              className="inp !py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-400">Até</span>
            <input
              type="date"
              value={ateLocal}
              min={de || undefined}
              onChange={(e) => setAte(e.target.value)}
              className="inp !py-1.5 text-xs"
            />
          </label>
          <button
            onClick={aplicarIntervalo}
            disabled={!de || !ateLocal}
            className="btn-volt !py-2 text-xs disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
