import { Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-300 text-ink-950 shadow-glow">
        <Dumbbell className="h-5 w-5" strokeWidth={2.5} />
      </span>
      {showText && (
        <span className="text-lg font-bold tracking-tight text-white">
          Gym<span className="text-volt-300">Flow</span>
        </span>
      )}
    </div>
  );
}
