"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConfirmButton({
  action,
  confirmText = "Tem certeza que deseja excluir?",
  label,
  className,
  variant = "icon",
}: {
  action: () => Promise<void>;
  confirmText?: string;
  label?: string;
  className?: string;
  variant?: "icon" | "row";
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const onClick = () => {
    if (!window.confirm(confirmText)) return;
    setErro(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao excluir.");
      }
    });
  };

  const conteudo = (
    <>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      {variant === "row" && (label ?? "Excluir")}
      {erro && <span className="ml-1 text-xs text-red-400">{erro}</span>}
    </>
  );

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={cn(
          "btn-ghost border-red-500/30 text-red-300 hover:border-red-400 hover:bg-red-500/10",
          className
        )}
      >
        {conteudo}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={label ?? "Excluir"}
        title={label ?? "Excluir"}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50",
          className
        )}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
      {erro && <span className="mt-1 text-xs text-red-400">{erro}</span>}
    </div>
  );
}
