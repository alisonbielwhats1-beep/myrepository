"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Dumbbell } from "lucide-react";
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

/** Estado de um dia na trilha da semana. */
type StatusDia = "feito" | "hoje" | "planejado" | "descanso";

const ROTULO_ESTADO: Record<StatusDia, string> = {
  feito: "CONCLUÍDO",
  hoje: "HOJE",
  planejado: "PLANEJADO",
  descanso: "DESCANSO",
};

// Ponto de status (auditoria de UX, item 6). Cores dos tokens do README.
const COR_PONTO: Record<StatusDia, string> = {
  feito: "bg-slate-300",
  hoje: "bg-volt-300",
  planejado: "bg-ink-500",
  descanso: "bg-ink-600",
};

/**
 * Aba Treinos como TRILHA DA SEMANA (auditoria de UX, itens 5 e 6): uma régua
 * de 7 dias com ponto de status (feito / hoje / planejado / descanso), o card
 * do dia selecionado com rótulo dinâmico, e o "resto do plano" em linhas
 * compactas. Ao abrir uma ficha, entra na execução (ExecucaoTreino).
 *
 * "Em andamento" vem sempre do estado da sessão (sessoesAtivas), nunca de um
 * campo do modelo — então só o plano realmente iniciado aparece assim.
 */
export default function TreinosDia({
  treinos,
  sessoesAtivas,
  recordes,
  diasFeitos = [],
  ...acoes
}: {
  treinos: FichaTreinoPublico[];
  sessoesAtivas: SessaoTreino[];
  recordes: Record<string, number>;
  /** Dias (1=seg…7=dom) já treinados nesta semana — para o status "feito". */
  diasFeitos?: number[];
} & AcoesExecucao) {
  const hoje = diaSemanaHojeSaoPaulo();
  const [diaSel, setDiaSel] = useState<DiaSemana>(hoje);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const sessaoDe = (treinoId: string) =>
    sessoesAtivas.find((s) => s.treino_id === treinoId) ?? null;

  const feitosSet = useMemo(() => new Set(diasFeitos), [diasFeitos]);

  // Uma ficha por dia (slots exclusivos por aluno, migration 091).
  const treinoDoDia = (d: DiaSemana): FichaTreinoPublico | null =>
    [...treinos].sort((a, b) => a.ordem - b.ordem).find((t) =>
      normalizarDias(t.dias_semana).includes(d)
    ) ?? null;

  const statusDoDia = (d: DiaSemana): StatusDia => {
    if (d === hoje) return "hoje";
    if (!treinoDoDia(d)) return "descanso";
    if (d < hoje && feitosSet.has(d)) return "feito";
    return "planejado";
  };

  if (treinos.length === 0) {
    return (
      <div className="surface rounded-2xl p-8 text-center text-slate-400">
        Seu treino ainda está sendo montado. Fale com a recepção da sua academia.
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
          <ArrowLeft className="h-4 w-4" /> Voltar à semana
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

  // --- Trilha da semana ----------------------------------------------------
  const treinoSel = treinoDoDia(diaSel);
  const statusSel = statusDoDia(diaSel);
  const resto = [...treinos]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((t) => t.id !== treinoSel?.id);

  // Próximo dia com treino a partir do selecionado — para o card de descanso.
  const proximoDia = (() => {
    for (let i = 1; i <= 7; i++) {
      const d = (((diaSel - 1 + i) % 7) + 1) as DiaSemana;
      if (treinoDoDia(d)) return d;
    }
    return null;
  })();

  const ctaPorEstado: Partial<Record<StatusDia, string>> = {
    feito: "Ver treino de novo",
    planejado: "Adiantar este treino",
  };

  return (
    <div className="space-y-5">
      {/* Régua de 7 dias com ponto de status */}
      <div
        className="grid grid-cols-7 gap-1.5"
        role="tablist"
        aria-label="Dias da semana"
      >
        {DIAS_SEMANA.map((d) => {
          const st = statusDoDia(d);
          const ativo = d === diaSel;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={ativo}
              aria-label={`${ROTULO_DIA_LONGO[d]} — ${ROTULO_ESTADO[st].toLowerCase()}`}
              onClick={() => setDiaSel(d)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-2 text-[11px] font-bold tracking-tight transition",
                ativo
                  ? "bg-volt-300 text-ink-950"
                  : st === "descanso"
                    ? "surface text-slate-500 hover:bg-ink-700"
                    : "surface text-slate-300 hover:bg-ink-700"
              )}
            >
              {ROTULO_DIA_CURTO[d]}
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  ativo ? "bg-ink-950/60" : COR_PONTO[st]
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> feito
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-volt-300" /> hoje
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-500" /> planejado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-600" /> descanso
        </span>
      </div>

      {/* Card do dia selecionado */}
      {treinoSel ? (
        <CardTreino
          treino={treinoSel}
          hoje={diaSel === hoje}
          emAndamento={!!sessaoDe(treinoSel.id)}
          rotuloEstado={`${ROTULO_ESTADO[statusSel]} · ${ROTULO_DIA_CURTO[diaSel]}`}
          ctaLabel={sessaoDe(treinoSel.id) ? undefined : ctaPorEstado[statusSel]}
          onAbrir={() => setAbertoId(treinoSel.id)}
        />
      ) : (
        <div className="surface rounded-2xl p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-slate-400">
            {ROTULO_ESTADO[statusSel]} · {ROTULO_DIA_CURTO[diaSel]}
          </p>
          <h3 className="mt-1 text-lg font-bold text-white">
            {diaSel === hoje ? "Dia de descanso — e está tudo certo." : "Dia de descanso"}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Sem treino programado para {diaSel === hoje ? "hoje" : "este dia"}.
            {proximoDia && (
              <> Próximo treino na {ROTULO_DIA_LONGO[proximoDia].toLowerCase()}.</>
            )}
          </p>
        </div>
      )}

      {/* Resto do plano */}
      {resto.length > 0 && (
        <section className="space-y-2">
          <p className="label-muted">Resto do plano</p>
          {resto.map((t) => {
            const qtd = t.exercicios?.length ?? 0;
            const dias = normalizarDias(t.dias_semana);
            const emAndamento = !!sessaoDe(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAbertoId(t.id)}
                className="surface flex w-full items-center gap-3 rounded-xl p-3 text-left transition active:scale-[0.99] hover:border-ink-500"
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-ink-700 text-[10.5px] font-bold text-slate-400">
                  {dias.length > 0 ? ROTULO_DIA_CURTO[dias[0]] : "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {t.nome_treino}
                    </span>
                    {emAndamento && (
                      <span className="flex-none rounded-full bg-cyanx-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyanx-400">
                        em andamento
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Dumbbell className="h-3 w-3" /> {qtd}{" "}
                    {qtd === 1 ? "exercício" : "exercícios"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 flex-none text-slate-500" />
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
