import { CalendarDays } from "lucide-react";
import { Treino } from "@/lib/types";
import { DIAS_SEMANA, ROTULO_DIA_CURTO, normalizarDias } from "@/lib/dias-semana";

/**
 * Resumo da semana: em que dia(s) cada ficha do aluno está programada, tudo
 * num único lugar (antes só dava pra ver isso reabrindo "Atribuir a aluno" lá
 * na Biblioteca de Treinos — o dono não tinha como olhar a ficha do aluno e já
 * saber a semana dele). Um chip por par (dia, ficha); fichas sem dia definido
 * (aparecem em "Tudo" pro aluno, todo dia) ficam num grupo à parte.
 */
export default function ResumoSemanalTreinos({ treinos }: { treinos: Treino[] }) {
  const porDia = DIAS_SEMANA.map((dia) => ({
    dia,
    treinos: treinos.filter((t) => normalizarDias(t.dias_semana).includes(dia)),
  })).filter((d) => d.treinos.length > 0);

  const semDia = treinos.filter(
    (t) => normalizarDias(t.dias_semana).length === 0
  );

  if (porDia.length === 0 && semDia.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <CalendarDays className="h-3.5 w-3.5" /> Semana
      </span>
      {porDia.map(({ dia, treinos: doDia }) => (
        <span
          key={dia}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 py-1 pl-2 pr-2.5 text-xs"
        >
          <b className="flex-none font-bold text-volt-300">
            {ROTULO_DIA_CURTO[dia]}
          </b>
          <span className="truncate text-slate-300">
            {doDia.map((t) => t.nome_treino).join(", ")}
          </span>
        </span>
      ))}
      {semDia.length > 0 && (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-dashed border-ink-600 py-1 pl-2 pr-2.5 text-xs text-slate-500">
          <span className="flex-none">Sem dia</span>
          <span className="truncate">
            {semDia.map((t) => t.nome_treino).join(", ")}
          </span>
        </span>
      )}
    </div>
  );
}
