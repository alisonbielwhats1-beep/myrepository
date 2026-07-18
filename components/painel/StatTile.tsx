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
    <div className="surface rounded-2xl p-4 sm:p-5">
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
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
