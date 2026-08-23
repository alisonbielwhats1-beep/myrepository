"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mensagem para quando a exclusão falha e não veio um motivo utilizável.
 *
 * Em produção o Next.js APAGA a mensagem de qualquer erro lançado por uma
 * Server Action e entrega ao cliente um texto genérico em inglês ("An error
 * occurred in the Server Action..."). Mostrar `e.message` direto, como era
 * feito antes, jogava esse inglês técnico na tela da recepção. Por isso as
 * ações de exclusão passaram a DEVOLVER `{ erro }` (texto já traduzido no
 * servidor, que sobrevive) em vez de lançar — e o catch abaixo virou só a
 * rede de segurança para o que ainda lança.
 */
const FALHA_GENERICA =
  "Não foi possível excluir. Atualize a página e tente de novo.";

/** Só aproveita a mensagem do erro se ela for legível para o usuário final. */
function mensagemUtil(e: unknown): string {
  if (!(e instanceof Error) || !e.message) return FALHA_GENERICA;
  const tecnica =
    /server action|server components|digest|constraint|violates|postgres|fetch failed/i;
  return tecnica.test(e.message) ? FALHA_GENERICA : e.message;
}

export default function ConfirmButton({
  action,
  confirmText = "Tem certeza que deseja excluir?",
  label,
  className,
  variant = "icon",
}: {
  /**
   * Devolver `{ erro }` é o caminho preferido: a mensagem chega inteira ao
   * usuário. `void` continua aceito para as ações que ainda lançam.
   */
  action: () => Promise<void | { erro?: string } | undefined>;
  confirmText?: string;
  label?: string;
  className?: string;
  variant?: "icon" | "row" | "menu";
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const onClick = () => {
    if (!window.confirm(confirmText)) return;
    setErro(null);
    startTransition(async () => {
      try {
        const resultado = await action();
        if (resultado && resultado.erro) setErro(resultado.erro);
      } catch (e) {
        setErro(mensagemUtil(e));
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
      {(variant === "row" || variant === "menu") && (label ?? "Excluir")}
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

  // Linha de menu de contexto ("•••"), mesmo estilo usado no menu de post da
  // Comunidade — sem borda própria, herda o fundo do painel ao passar o mouse.
  if (variant === "menu") {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        disabled={pending}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 hover:bg-ink-700 disabled:opacity-50",
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
