import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "volt",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: "volt" | "magenta" | "cyan" | "slate";
}) {
  const accentMap = {
    volt: "text-volt-300 bg-volt-500/10",
    magenta: "text-magenta-400 bg-magenta-500/10",
    cyan: "text-cyanx-400 bg-cyanx-500/10",
    slate: "text-slate-300 bg-ink-700",
  } as const;

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="label-muted">{label}</span>
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl",
            accentMap[accent]
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className="mt-3 stat-value">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
