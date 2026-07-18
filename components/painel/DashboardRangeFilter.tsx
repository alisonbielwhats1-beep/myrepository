"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGES_DASHBOARD, RangeDashboard } from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Filtro de período do Dashboard (semana / mês / 6 meses / 12 meses). */
export default function DashboardRangeFilter({
  range,
}: {
  range: RangeDashboard;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const ir = (valor: RangeDashboard) => {
    const p = new URLSearchParams(params.toString());
    p.set("range", valor);
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1">
      {RANGES_DASHBOARD.map((r) => (
        <button
          key={r.valor}
          onClick={() => ir(r.valor)}
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
    </div>
  );
}
