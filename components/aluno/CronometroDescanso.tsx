"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cronômetro de descanso entre séries — aparece durante a execução do treino.
 *
 * É 100% client-side: nada é gravado no banco, é só uma ferramenta pro aluno
 * usar entre uma série e outra. Usa o descanso prescrito do exercício como
 * padrão (cai em 60s quando não há prescrição) e VIBRA ao zerar, quando o
 * aparelho suporta (`navigator.vibrate`). Não usa áudio de propósito: evitaria
 * depender de asset e de autoplay, que o navegador bloqueia — e vibração é o
 * que funciona com o celular no bolso ou no banco do aparelho.
 *
 * A contagem é ancorada num timestamp real (`alvoRef`), não numa soma de ticks:
 * se a aba vai para segundo plano e o `setInterval` é estrangulado, ao voltar o
 * tempo restante ainda está correto — o relógio de parede não mente.
 */
export default function CronometroDescanso({
  segundosPadrao,
}: {
  segundosPadrao: number;
}) {
  const base = segundosPadrao > 0 ? segundosPadrao : 60;
  const [restante, setRestante] = useState(base);
  const [rodando, setRodando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const alvoRef = useRef(0); // timestamp (ms) em que a contagem zera

  useEffect(() => {
    if (!rodando || pausado) return;
    const id = setInterval(() => {
      const seg = Math.max(0, Math.round((alvoRef.current - Date.now()) / 1000));
      setRestante(seg);
      if (seg <= 0) {
        setRodando(false);
        setPausado(false);
        setTerminou(true);
        navigator.vibrate?.([120, 60, 120]);
        window.setTimeout(() => setTerminou(false), 2600);
      }
    }, 250);
    return () => clearInterval(id);
  }, [rodando, pausado]);

  const iniciar = (seg: number) => {
    alvoRef.current = Date.now() + seg * 1000;
    setRestante(seg);
    setTerminou(false);
    setPausado(false);
    setRodando(true);
  };

  const somar = (seg: number) => {
    alvoRef.current += seg * 1000;
    setRestante((r) => r + seg);
  };

  const alternarPausa = () => {
    if (pausado) {
      alvoRef.current = Date.now() + restante * 1000; // retoma do congelado
      setPausado(false);
    } else {
      setPausado(true);
    }
  };

  const cancelar = () => {
    setRodando(false);
    setPausado(false);
    setRestante(base);
  };

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- Ocioso: um único botão pra começar a descansar. --------------------
  if (!rodando) {
    return (
      <button
        type="button"
        onClick={() => iniciar(base)}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]",
          terminou
            ? "border-volt-500/40 bg-volt-500/10 text-volt-300"
            : "border-ink-600 bg-ink-800 text-slate-200 hover:bg-ink-700"
        )}
      >
        <Timer className="h-4 w-4 text-volt-300" />
        {terminou ? "Descanso concluído — bora! 💪" : `Descansar ${mmss(base)}`}
      </button>
    );
  }

  // --- Contando (ou pausado). ---------------------------------------------
  const pct = Math.min(100, (restante / base) * 100);
  return (
    <div className="mt-3 rounded-xl border border-volt-500/30 bg-volt-500/[0.06] p-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "tabular-nums text-2xl font-bold",
            restante <= 5 ? "text-magenta-400" : "text-volt-300"
          )}
        >
          {mmss(restante)}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => somar(15)}
            className="chip border-ink-600 bg-ink-700/60 text-slate-200"
            aria-label="Adicionar 15 segundos"
          >
            <Plus className="h-3.5 w-3.5" /> 15s
          </button>
          <button
            type="button"
            onClick={alternarPausa}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-600 bg-ink-700 text-slate-200"
            aria-label={pausado ? "Retomar descanso" : "Pausar descanso"}
          >
            {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={cancelar}
            className="grid h-8 w-8 place-items-center rounded-lg border border-ink-600 bg-ink-700 text-slate-400"
            aria-label="Cancelar descanso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-linear",
            restante <= 5 ? "bg-magenta-400" : "bg-volt-400"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
