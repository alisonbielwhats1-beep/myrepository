"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarX2 } from "lucide-react";
import type { FichaTreinoPublico, SessaoTreino } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DIAS_SEMANA,
  DiaSemana,
  ROTULO_DIA_CURTO,
  ROTULO_DIA_LONGO,
  diaSemanaHojeSaoPaulo,
  normalizarDias,
} from "@/lib/dias-semana";
import CardTreino from "./CardTreino";
import ExecucaoTreino, { AcoesExecucao } from "./ExecucaoTreino";

type Filtro = "todos" | DiaSemana;

/**
 * Tela de Treinos "por dia": um seletor horizontal (Todos · Seg … Dom) que
 * destaca o dia atual e mostra só as fichas daquele dia. Ao abrir uma ficha,
 * entra na execução (ExecucaoTreino) com um botão de voltar. Fichas sem dia
 * definido aparecem só em "Todos" — nunca somem.
 */
export default function TreinosDia({
  treinos,
  sessoesAtivas,
  recordes,
  ...acoes
}: {
  treinos: FichaTreinoPublico[];
  sessoesAtivas: SessaoTreino[];
  recordes: Record<string, number>;
} & AcoesExecucao) {
  const hoje = diaSemanaHojeSaoPaulo();
  // Se hoje tem algum treino, começa no dia atual; senão, em "Todos".
  const temTreinoHoje = treinos.some((t) => normalizarDias(t.dias_semana).includes(hoje));
  const [filtro, setFiltro] = useState<Filtro>(temTreinoHoje ? hoje : "todos");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const sessaoDe = (treinoId: string) =>
    sessoesAtivas.find((s) => s.treino_id === treinoId) ?? null;

  const visiveis = useMemo(() => {
    if (filtro === "todos") return [...treinos].sort((a, b) => a.ordem - b.ordem);
    return treinos
      .filter((t) => normalizarDias(t.dias_semana).includes(filtro))
      .sort((a, b) => a.ordem - b.ordem);
  }, [treinos, filtro]);

  if (treinos.length === 0) {
    return (
      <div className="surface rounded-2xl p-8 text-center text-slate-400">
        Nenhum treino atribuído ainda. Fale com a recepção da sua academia.
      </div>
    );
  }

  // --- Execução de uma ficha aberta ---------------------------------------
  const treinoAberto = abertoId ? treinos.find((t) => t.id === abertoId) : null;
  if (treinoAberto) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setAbertoId(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos treinos
        </button>
        {/* key força remount ao trocar de ficha — evita estado de sessão vazar entre treinos */}
        <ExecucaoTreino
          key={treinoAberto.id}
          treino={treinoAberto}
          sessaoInicial={sessaoDe(treinoAberto.id)}
          recordes={recordes}
          {...acoes}
        />
      </div>
    );
  }

  // --- Seletor de dias + lista --------------------------------------------
  return (
    <div className="space-y-5">
      <div
        className="flex gap-1"
        role="tablist"
        aria-label="Filtrar treinos por dia da semana"
      >
        <ChipDia
          ativo={filtro === "todos"}
          hoje={false}
          onClick={() => setFiltro("todos")}
          label="Tudo"
          aria-label="Todos os dias"
        />
        {DIAS_SEMANA.map((d) => (
          <ChipDia
            key={d}
            ativo={filtro === d}
            hoje={d === hoje}
            onClick={() => setFiltro(d)}
            label={ROTULO_DIA_CURTO[d]}
            aria-label={ROTULO_DIA_LONGO[d]}
          />
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-700 text-slate-500">
            <CalendarX2 className="h-6 w-6" />
          </span>
          <p className="font-semibold text-white">
            {filtro === hoje
              ? "Nenhum treino programado para hoje."
              : "Nenhum treino neste dia."}
          </p>
          <p className="max-w-xs text-sm text-slate-400">
            Toque em <span className="font-medium text-slate-300">TODOS</span> para
            ver suas outras fichas ou escolha outro dia.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visiveis.map((t) => (
            <CardTreino
              key={t.id}
              treino={t}
              hoje={normalizarDias(t.dias_semana).includes(hoje)}
              emAndamento={!!sessaoDe(t.id)}
              onAbrir={() => setAbertoId(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChipDia({
  ativo,
  hoje,
  onClick,
  label,
  ...rest
}: {
  ativo: boolean;
  hoje: boolean;
  onClick: () => void;
  label: string;
} & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        // flex-1 + min-w-0: os 8 chips (Tudo + 7 dias) dividem a largura e
        // cabem inteiros em 375px, sem rolagem horizontal e sem cortar a semana.
        "relative min-w-0 flex-1 rounded-lg px-0 py-2 text-center text-[11px] font-bold tracking-tight transition",
        ativo
          ? "bg-volt-300 text-ink-950"
          : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
      )}
      {...rest}
    >
      {label}
      {hoje && !ativo && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-volt-300" />
      )}
    </button>
  );
}
