"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão "Excluir" com confirmação nativa antes de disparar uma Server Action.
 * Usado nas listas (alunos, funcionários, receitas, despesas) para que toda
 * exclusão exija confirmação explícita do usuário.
 */
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

  const onClick = () => {
    if (!window.confirm(confirmText)) return;
    startTransition(() => {
      action();
    });
  };

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
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {label ?? "Excluir"}
      </button>
    );
  }

  return (
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
  );
}
