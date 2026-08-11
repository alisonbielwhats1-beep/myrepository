"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function PainelErro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GestAcad] Erro no painel:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">Não conseguimos carregar esta tela</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          {/*
            Antes esta linha mostrava `error.message`. Em produção o Next.js
            substitui a mensagem de qualquer erro de servidor por um texto
            genérico EM INGLÊS ("An error occurred in the Server Components
            render...") — ou seja, o cliente lia justamente o jargão que não
            deveria ver. O detalhe técnico continua inteiro no console (efeito
            acima) e no log da Vercel; aqui fica o que a recepção pode fazer.
          */}
          Nenhum dado foi perdido. Clique em &ldquo;Tentar novamente&rdquo; — se o
          problema continuar, informe o código abaixo ao suporte.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-600">Código: {error.digest}</p>
        )}
      </div>
      <button onClick={reset} className="btn-ghost flex items-center gap-2">
        <RotateCcw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}
