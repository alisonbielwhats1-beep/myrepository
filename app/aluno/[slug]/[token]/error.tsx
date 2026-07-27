"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

export default function ErroAluno({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-red-400">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <h1 className="text-lg font-bold text-white">Algo deu errado</h1>
      <p className="max-w-xs text-sm text-slate-400">
        Não foi possível carregar esta tela. Verifique sua conexão e tente
        novamente.
      </p>
      <button onClick={() => reset()} className="btn-volt mt-2">
        <RotateCw className="h-4 w-4" /> Tentar novamente
      </button>
    </div>
  );
}
