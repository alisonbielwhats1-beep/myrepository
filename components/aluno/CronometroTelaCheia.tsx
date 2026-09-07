"use client";

import {
  ChevronDown,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Apresentação do descanso — tela cheia e barra recolhida.
 *
 * Só desenha: quem conta o tempo, toca o bipe e segura a tela acesa é o
 * ProvedorDescanso. Separar assim mantém a máquina de estados num lugar só e
 * deixa o layout livre pra mudar sem risco de quebrar a contagem.
 */

export function mmss(s: number) {
  const seg = Math.max(0, s);
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

const RAIO = 104;
const CIRC = 2 * Math.PI * RAIO;

export type ControlesDescanso = {
  exercicio: string;
  /** Prescrição em texto curto (ex: "3 × 12 · 30 kg"). */
  detalhe?: string | null;
  /** Nome do próximo exercício da ficha — dica pro aluno já se preparar. */
  proximo?: string | null;
  restante: number;
  base: number;
  pausado: boolean;
  terminou: boolean;
  mudo: boolean;
  alternarPausa: () => void;
  somar: (segundos: number) => void;
  alternarMudo: () => void;
  minimizar: () => void;
  expandir: () => void;
  encerrar: () => void;
};

/** Anel de progresso. Compartilhado pelos dois tamanhos (tela cheia e barra). */
function Anel({
  fracao,
  urgente,
  espessura,
  className,
}: {
  fracao: number;
  urgente: boolean;
  espessura: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 240 240" className={cn("-rotate-90", className)} aria-hidden="true">
      <circle
        cx="120"
        cy="120"
        r={RAIO}
        fill="none"
        strokeWidth={espessura}
        className="stroke-ink-700"
      />
      <circle
        cx="120"
        cy="120"
        r={RAIO}
        fill="none"
        strokeWidth={espessura}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - Math.max(0, Math.min(1, fracao)))}
        className={cn(
          "transition-[stroke-dashoffset] duration-200 ease-linear",
          urgente ? "stroke-magenta-400" : "stroke-volt-300"
        )}
      />
    </svg>
  );
}

export default function TelaCheiaDescanso(p: ControlesDescanso) {
  const fracao = p.base > 0 ? p.restante / p.base : 0;
  const urgente = !p.terminou && p.restante <= 5;
  // Últimos 3 segundos viram contagem gigante — é o sinal que o aluno pega de
  // canto de olho, sem precisar ler "0:03".
  const contagemFinal = !p.terminou && p.restante > 0 && p.restante <= 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cronômetro de descanso"
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/95 backdrop-blur-md"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <header className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{p.exercicio}</p>
          {p.detalhe && (
            <p className="mt-0.5 truncate text-xs text-slate-400">{p.detalhe}</p>
          )}
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            onClick={p.alternarMudo}
            aria-label={p.mudo ? "Ativar som do cronômetro" : "Silenciar cronômetro"}
            aria-pressed={p.mudo}
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-ink-800 hover:text-slate-200"
          >
            {p.mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={p.minimizar}
            aria-label="Recolher cronômetro"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-ink-800 hover:text-slate-200"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5">
        <div className="relative aspect-square w-[min(74vw,19rem)]">
          <Anel fracao={fracao} urgente={urgente} espessura={13} className="h-full w-full" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {p.terminou ? (
              <span className="text-3xl font-bold text-volt-300">Bora! 💪</span>
            ) : (
              <>
                <span
                  className={cn(
                    "font-bold leading-none tabular-nums",
                    contagemFinal ? "text-8xl" : "text-6xl",
                    urgente ? "text-magenta-400" : "text-white"
                  )}
                >
                  {contagemFinal ? p.restante : mmss(p.restante)}
                </span>
                <span className="mt-3 text-xs uppercase tracking-widest text-slate-500">
                  {p.pausado ? "pausado" : "descanso"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* O número muda a cada segundo: anunciá-lo seria ruído no leitor de
          tela. Só o fim do descanso é falado. */}
      <span className="sr-only" aria-live="polite">
        {p.terminou ? "Descanso concluído" : ""}
      </span>

      <div className="flex items-center justify-center gap-5 px-5">
        <button
          type="button"
          onClick={() => p.somar(-15)}
          disabled={p.restante <= 15}
          aria-label="Tirar 15 segundos"
          className="flex items-center gap-1 rounded-xl border border-ink-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-ink-800 active:scale-[0.98] disabled:opacity-35"
        >
          <Minus className="h-4 w-4" /> 15s
        </button>
        <button
          type="button"
          onClick={p.alternarPausa}
          aria-label={p.pausado ? "Retomar descanso" : "Pausar descanso"}
          className="grid h-16 w-16 place-items-center rounded-full bg-volt-300 text-ink-950 shadow-glow transition active:scale-95"
        >
          {p.pausado ? (
            <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" />
          ) : (
            <Pause className="h-7 w-7" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          onClick={() => p.somar(15)}
          aria-label="Adicionar 15 segundos"
          className="flex items-center gap-1 rounded-xl border border-ink-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-ink-800 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> 15s
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-ink-600/50 px-5 pt-4">
        <p className="min-w-0 truncate text-xs text-slate-500">
          {p.proximo ? (
            <>
              A seguir: <span className="text-slate-300">{p.proximo}</span>
            </>
          ) : (
            "Último exercício da ficha"
          )}
        </p>
        <button
          type="button"
          onClick={p.encerrar}
          className="flex flex-none items-center gap-1.5 text-sm font-semibold text-volt-300 transition hover:opacity-80"
        >
          Pular <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Barra recolhida: o descanso continua vivo enquanto o aluno confere a carga
 * do próximo exercício. Fica acima da AlunoTabBar (que é `fixed bottom-0` com
 * margem de 12px) — daí o `bottom-[5.5rem]`.
 */
export function BarraDescanso(p: ControlesDescanso) {
  const fracao = p.base > 0 ? p.restante / p.base : 0;
  const urgente = !p.terminou && p.restante <= 5;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] z-40 mx-auto max-w-md px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-volt-500/40 bg-ink-800/95 p-2.5 shadow-card backdrop-blur-lg">
        <button
          type="button"
          onClick={p.expandir}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label="Abrir cronômetro em tela cheia"
        >
          <span className="relative h-9 w-9 flex-none">
            <Anel fracao={fracao} urgente={urgente} espessura={26} className="h-full w-full" />
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block text-base font-bold leading-tight tabular-nums",
                p.terminou ? "text-volt-300" : urgente ? "text-magenta-400" : "text-white"
              )}
            >
              {p.terminou ? "Bora! 💪" : mmss(p.restante)}
            </span>
            <span className="block truncate text-[11px] text-slate-400">
              {p.pausado ? "pausado · " : ""}
              {p.exercicio}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={p.alternarPausa}
          aria-label={p.pausado ? "Retomar descanso" : "Pausar descanso"}
          className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-ink-600 bg-ink-700 text-slate-200"
        >
          {p.pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={p.expandir}
          aria-label="Abrir cronômetro em tela cheia"
          className="grid h-9 w-9 flex-none place-items-center rounded-xl border border-ink-600 bg-ink-700 text-slate-400"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
