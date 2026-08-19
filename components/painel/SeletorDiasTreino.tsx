"use client";

import { cn } from "@/lib/utils";
import { DIAS_SEMANA, DiaSemana, ROTULO_DIA_CURTO } from "@/lib/dias-semana";

/**
 * Seletor de dias da semana de uma ficha (item 7). Um treino pode valer para
 * um dia, vários ou todos — sem criar cópias. Controlado por `value`/`onChange`.
 * Quando `name` é informado, também emite inputs de formulário (um por dia
 * marcado) para envio via Server Action; sem `name`, é só estado em memória
 * (edição inline com botão de salvar).
 */
export default function SeletorDiasTreino({
  value,
  onChange,
  name,
  disabled = false,
}: {
  value: number[];
  onChange: (dias: DiaSemana[]) => void;
  name?: string;
  disabled?: boolean;
}) {
  const todos = value.length === DIAS_SEMANA.length;

  function alternar(d: DiaSemana) {
    if (value.includes(d)) onChange(value.filter((x) => x !== d) as DiaSemana[]);
    else onChange([...value, d].sort((a, b) => a - b) as DiaSemana[]);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {DIAS_SEMANA.map((d) => {
          const ativo = value.includes(d);
          return (
            <label
              key={d}
              className={cn(
                "cursor-pointer select-none rounded-lg border px-3 py-1.5 text-xs font-bold tracking-wide transition",
                ativo
                  ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                  : "border-ink-600 bg-ink-900/50 text-slate-400 hover:border-ink-500",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={ativo}
                disabled={disabled}
                onChange={() => alternar(d)}
              />
              {ROTULO_DIA_CURTO[d]}
            </label>
          );
        })}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange(todos ? [] : ([...DIAS_SEMANA] as DiaSemana[]))
        }
        className="mt-2 text-xs font-medium text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline disabled:opacity-60"
      >
        {todos ? "Limpar todos" : "Selecionar todos"}
      </button>

      {/* Inputs para o Server Action quando dentro de um <form>. */}
      {name &&
        value
          .slice()
          .sort((a, b) => a - b)
          .map((d) => <input key={d} type="hidden" name={name} value={d} />)}
    </div>
  );
}
