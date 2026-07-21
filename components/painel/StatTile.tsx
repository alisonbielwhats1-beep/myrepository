import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, LucideIcon, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "volt",
  href,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "volt" | "magenta" | "cyan" | "slate";
  /** Se informado, o card vira um link clicável para esta rota. */
  href?: string;
  /** Comparativo vs período anterior. `pct` em %, `positivoBom` inverte a cor
   *  (ex.: em despesa, subir é ruim). */
  delta?: { pct: number; positivoBom?: boolean };
}) {
  const accentMap = {
    volt: "text-volt-300 bg-volt-500/10",
    magenta: "text-magenta-400 bg-magenta-500/10",
    cyan: "text-cyanx-400 bg-cyanx-500/10",
    slate: "text-slate-300 bg-ink-700",
  } as const;

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="label-muted min-w-0">{label}</span>
        <span
          className={cn(
            "grid h-8 w-8 flex-none place-items-center rounded-xl sm:h-9 sm:w-9",
            accentMap[accent]
          )}
        >
          <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
        </span>
      </div>
      <div className="mt-3 stat-value">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {delta && <DeltaBadge pct={delta.pct} positivoBom={delta.positivoBom ?? true} />}
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </>
  );

  const classe = cn(
    "surface block rounded-2xl p-4 sm:p-5",
    href && "transition hover:border-volt-500/30 hover:bg-ink-800/60"
  );

  if (href) {
    return (
      <Link href={href} className={classe}>
        {conteudo}
      </Link>
    );
  }
  return <div className={classe}>{conteudo}</div>;
}

/** Selo ↑/↓ com a variação percentual vs período anterior. */
function DeltaBadge({ pct, positivoBom }: { pct: number; positivoBom: boolean }) {
  const nulo = !isFinite(pct) || Math.round(pct) === 0;
  const subiu = pct > 0;
  // Se "subir é bom" (receita), verde quando sobe. Em despesa, vermelho quando sobe.
  const bom = subiu === positivoBom;
  const Icone = nulo ? Minus : subiu ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        nulo
          ? "bg-ink-700 text-slate-400"
          : bom
          ? "bg-volt-500/10 text-volt-300"
          : "bg-magenta-500/10 text-magenta-400"
      )}
      title="vs. período anterior"
    >
      <Icone className="h-3 w-3" />
      {nulo ? "—" : `${Math.abs(Math.round(pct))}%`}
    </span>
  );
}
