"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Loader2, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de ações padrão para formulários: Voltar (rota anterior), Cancelar
 * (fecha/reseta o formulário atual) e Salvar (submit). Usada em todos os
 * formulários do painel para que o usuário nunca fique "preso" numa tela.
 */
export default function FormActions({
  voltarHref,
  onCancelar,
  salvarLabel = "Salvar",
  className,
}: {
  voltarHref?: string;
  onCancelar?: () => void;
  salvarLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5 pt-1", className)}>
      {voltarHref && (
        <Link href={voltarHref} className="btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      )}
      {onCancelar && (
        <button type="button" onClick={onCancelar} className="btn-ghost">
          <X className="h-4 w-4" /> Cancelar
        </button>
      )}
      <BotaoSalvar label={salvarLabel} />
    </div>
  );
}

function BotaoSalvar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt ml-auto">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? "Salvando..." : label}
    </button>
  );
}
