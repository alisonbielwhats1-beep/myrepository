"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { removerAcademia } from "./actions";

export default function RemoverAcademiaBtn({
  academiaId,
  nome,
}: {
  academiaId: string;
  nome: string;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();

  function handleRemover() {
    start(async () => {
      await removerAcademia(academiaId);
    });
  }

  if (confirmar) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-xs text-red-300">Remover "{nome}"?</span>
        <button
          onClick={handleRemover}
          disabled={pending}
          className="rounded px-2 py-1 text-xs bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-1"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirmar
        </button>
        <button
          onClick={() => setConfirmar(false)}
          disabled={pending}
          className="rounded px-2 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirmar(true)}
      className="rounded p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      title="Remover academia"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
