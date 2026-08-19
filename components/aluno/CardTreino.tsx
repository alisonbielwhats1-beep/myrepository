"use client";

import { ChevronRight, Clock3, Dumbbell, Flame, PlayCircle } from "lucide-react";
import type { FichaTreinoPublico } from "@/lib/types";
import { cn } from "@/lib/utils";
import { resumoDias } from "@/lib/dias-semana";

/**
 * Divide "Treino A - Peito e Tríceps" em título ("Treino A") + grupos
 * ("Peito e Tríceps"). Aceita hífen simples ou travessão. Se não houver
 * separador, o nome inteiro vira título e não há subtítulo de grupos.
 */
function separarNome(nome: string): { titulo: string; grupos: string | null } {
  const partes = nome.split(/\s+[-–—]\s+/);
  if (partes.length < 2) return { titulo: nome.trim(), grupos: null };
  return { titulo: partes[0].trim(), grupos: partes.slice(1).join(" · ").trim() };
}

/**
 * Estimativa grosseira de duração: por exercício, séries × (execução + descanso).
 * Só para dar noção ("≈ 45 min") — nunca um número exato.
 */
function estimarMinutos(treino: FichaTreinoPublico): number {
  const total = (treino.exercicios ?? []).reduce((soma, e) => {
    const descanso = e.descanso_segundos ?? 60;
    const series = e.series > 0 ? e.series : 3;
    return soma + series * (40 + descanso);
  }, 0);
  return Math.max(5, Math.round(total / 60));
}

export default function CardTreino({
  treino,
  hoje = false,
  emAndamento = false,
  onAbrir,
}: {
  treino: FichaTreinoPublico;
  /** true se a ficha se aplica ao dia atual — ganha destaque visual. */
  hoje?: boolean;
  /** true se já existe uma sessão ativa deste treino (Retomar). */
  emAndamento?: boolean;
  onAbrir: () => void;
}) {
  const { titulo, grupos } = separarNome(treino.nome_treino);
  const qtd = treino.exercicios?.length ?? 0;
  const minutos = estimarMinutos(treino);
  const preview = [...(treino.exercicios ?? [])]
    .sort((a, b) => a.ordem - b.ordem)
    .slice(0, 3);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "surface w-full rounded-2xl p-4 text-left transition active:scale-[0.99] hover:border-ink-500",
        hoje && "border-volt-400/50 bg-volt-500/[0.06] shadow-glow"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-white">{titulo}</h3>
            {hoje && (
              <span className="chip border-volt-400/40 bg-volt-400/15 text-volt-300">
                <Flame className="h-3 w-3" /> Hoje
              </span>
            )}
            {emAndamento && (
              <span className="chip border-cyanx-400/30 bg-cyanx-400/10 text-cyanx-400">
                Em andamento
              </span>
            )}
          </div>
          {(grupos || treino.objetivo) && (
            <p className="mt-0.5 truncate text-sm text-slate-400">
              {grupos ?? treino.objetivo}
            </p>
          )}
        </div>
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            hoje ? "bg-volt-300/15 text-volt-300" : "bg-ink-700 text-slate-300"
          )}
        >
          <Dumbbell className="h-5 w-5" />
        </span>
      </div>

      {/* Meta: nº de exercícios · duração estimada · dias */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Dumbbell className="h-3.5 w-3.5" /> {qtd} {qtd === 1 ? "exercício" : "exercícios"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5" /> ≈ {minutos} min
        </span>
        <span className="text-slate-500">{resumoDias(treino.dias_semana)}</span>
      </div>

      {/* Prévia dos primeiros exercícios */}
      {preview.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-ink-600/50 pt-3">
          {preview.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-300">{e.nome_exercicio}</span>
              <span className="flex-none tabular-nums text-slate-500">
                {e.series} × {e.repeticoes}
              </span>
            </li>
          ))}
          {qtd > preview.length && (
            <li className="text-xs text-slate-500">+ {qtd - preview.length} exercícios</li>
          )}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-volt-300">
          <PlayCircle className="h-4 w-4" />
          {emAndamento ? "Retomar treino" : "Iniciar treino"}
        </span>
        <ChevronRight className="h-5 w-5 text-slate-500" />
      </div>
    </button>
  );
}
