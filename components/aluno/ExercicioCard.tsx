"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Dumbbell, RotateCcw, Timer, Weight } from "lucide-react";
import { ExercicioTreino } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Card de exercício da visão do aluno. Mostra a foto NATIVA do movimento
 * (sem filtros — classe `media-native`), séries, repetições, carga e um
 * botão "Concluído" por exercício.
 */
export default function ExercicioCard({ ex }: { ex: ExercicioTreino }) {
  const [feito, setFeito] = useState(false);

  return (
    <div
      className={cn(
        "surface overflow-hidden rounded-2xl transition",
        feito && "border-volt-500/40 bg-volt-500/[0.06]"
      )}
    >
      {/* Foto nativa do movimento — sem retângulo de fundo poluindo a mídia */}
      <div className="relative aspect-[16/10] w-full bg-ink-900">
        {ex.imagem_demonstracao_url ? (
          <Image
            src={ex.imagem_demonstracao_url}
            alt={ex.nome_exercicio}
            fill
            sizes="(max-width: 480px) 100vw, 480px"
            className="media-native object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-slate-600">
            <Dumbbell className="h-10 w-10" />
          </div>
        )}
        {feito && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/55">
            <span className="chip border-volt-500/40 bg-volt-500/20 text-volt-200">
              <Check className="h-3.5 w-3.5" /> Concluído
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-base font-semibold text-white">
          {ex.nome_exercicio}
        </h3>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
            <RotateCcw className="h-3.5 w-3.5 text-volt-300" />
            {ex.series} séries
          </span>
          <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
            <Dumbbell className="h-3.5 w-3.5 text-cyanx-400" />
            {ex.repeticoes} reps
          </span>
          {ex.carga_kg != null && ex.carga_kg > 0 && (
            <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
              <Weight className="h-3.5 w-3.5 text-magenta-400" />
              {ex.carga_kg} kg
            </span>
          )}
          {ex.descanso_segundos != null && (
            <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
              <Timer className="h-3.5 w-3.5 text-slate-400" />
              {ex.descanso_segundos}s
            </span>
          )}
        </div>

        {ex.observacoes && (
          <p className="mt-3 text-sm text-slate-400">{ex.observacoes}</p>
        )}

        <button
          onClick={() => setFeito((f) => !f)}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
            feito
              ? "border border-ink-600 bg-ink-700 text-slate-300 hover:bg-ink-600"
              : "bg-volt-300 text-ink-950 shadow-glow hover:bg-volt-200"
          )}
        >
          <Check className="h-4 w-4" />
          {feito ? "Desfazer" : "Marcar como concluído"}
        </button>
      </div>
    </div>
  );
}
