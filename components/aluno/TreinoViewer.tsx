"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { Treino } from "@/lib/types";
import { cn } from "@/lib/utils";
import ExercicioCard from "./ExercicioCard";

export default function TreinoViewer({ treinos }: { treinos: Treino[] }) {
  const [ativo, setAtivo] = useState(0);

  if (treinos.length === 0) {
    return (
      <div className="surface rounded-2xl p-8 text-center text-slate-400">
        Nenhum treino atribuído ainda. Fale com a recepção da sua academia.
      </div>
    );
  }

  const treino = treinos[ativo];
  const exercicios = [...(treino.exercicios ?? [])].sort(
    (a, b) => a.ordem - b.ordem
  );

  return (
    <div className="space-y-5">
      {/* Seletor de fichas (Treino A / B / C) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {treinos.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setAtivo(i)}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
              i === ativo
                ? "bg-volt-300 text-ink-950 shadow-glow"
                : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
            )}
          >
            {t.nome_treino.split(" - ")[0] || t.nome_treino}
          </button>
        ))}
      </div>

      {/* Cabeçalho da ficha */}
      <div className="surface rounded-2xl p-4">
        <h2 className="text-lg font-bold text-white">{treino.nome_treino}</h2>
        {treino.objetivo && (
          <span className="chip mt-2 border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
            <Target className="h-3.5 w-3.5" /> {treino.objetivo}
          </span>
        )}
        <p className="mt-2 text-sm text-slate-400">
          {exercicios.length} exercícios
        </p>
      </div>

      {/* Lista de exercícios */}
      <div className="space-y-4">
        {exercicios.map((ex) => (
          <ExercicioCard key={ex.id} ex={ex} />
        ))}
      </div>
    </div>
  );
}
