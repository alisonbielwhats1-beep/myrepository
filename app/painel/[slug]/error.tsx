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
    console.error("[GymFlow] Erro no painel:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">Algo deu errado</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          {error.message ?? "Ocorreu um erro inesperado ao carregar esta página."}
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
