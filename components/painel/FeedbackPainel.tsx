"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquare, Star, UserRound } from "lucide-react";
import { CATEGORIAS_FEEDBACK, Feedback } from "@/lib/types";
import { cn } from "@/lib/utils";
import ConfirmButton from "@/components/ui/ConfirmButton";
import {
  excluirFeedback,
  marcarFeedbackLido,
} from "@/app/painel/[slug]/feedback/actions";

function rotuloCategoria(c: string | null): string {
  if (!c) return "Geral";
  return CATEGORIAS_FEEDBACK.find((x) => x.value === c)?.label ?? c;
}

export default function FeedbackPainel({
  slug,
  feedbacks,
}: {
  slug: string;
  feedbacks: Feedback[];
}) {
  const [filtro, setFiltro] = useState<"todos" | "nao_lidos">("todos");

  const media = useMemo(() => {
    if (feedbacks.length === 0) return 0;
    return feedbacks.reduce((a, f) => a + f.nota, 0) / feedbacks.length;
  }, [feedbacks]);

  const naoLidos = feedbacks.filter((f) => !f.lido).length;
  const lista = filtro === "nao_lidos" ? feedbacks.filter((f) => !f.lido) : feedbacks;

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">Média</p>
          <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-volt-300">
            {feedbacks.length ? media.toFixed(1) : "—"}
            <Star className="h-4 w-4 fill-volt-300 text-volt-300" />
          </p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">Avaliações</p>
          <p className="mt-1 text-2xl font-bold text-white">{feedbacks.length}</p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">Não lidos</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold",
              naoLidos > 0 ? "text-amber-300" : "text-white"
            )}
          >
            {naoLidos}
          </p>
        </div>
      </div>

      {/* Filtro */}
      <div className="inline-flex gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1">
        {(
          [
            { v: "todos", l: "Todos" },
            { v: "nao_lidos", l: `Não lidos (${naoLidos})` },
          ] as const
        ).map((op) => (
          <button
            key={op.v}
            onClick={() => setFiltro(op.v)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              filtro === op.v
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
            )}
          >
            {op.l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          {feedbacks.length === 0
            ? "Nenhuma avaliação recebida ainda. Os alunos podem enviar feedback pela tela deles."
            : "Nenhuma avaliação não lida."}
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((f) => (
            <li
              key={f.id}
              className={cn(
                "surface rounded-2xl p-4",
                !f.lido && "ring-1 ring-volt-500/30"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-slate-400">
                    <UserRound className="h-4 w-4" />
                    <span className="text-sm font-medium text-white">
                      {f.aluno?.nome ?? "Anônimo"}
                    </span>
                  </span>
                  <span className="chip border-ink-600 bg-ink-700/60 text-slate-300">
                    {rotuloCategoria(f.categoria)}
                  </span>
                  {!f.lido && (
                    <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
                      novo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "h-4 w-4",
                        f.nota >= n
                          ? "fill-volt-300 text-volt-300"
                          : "text-slate-600"
                      )}
                    />
                  ))}
                </div>
              </div>

              {f.comentario && (
                <p className="mt-2 text-sm text-slate-300">“{f.comentario}”</p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-ink-700 pt-3">
                <span className="text-xs text-slate-500">
                  {new Date(f.criado_em).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => marcarFeedbackLido(slug, f.id, !f.lido)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-ink-700 hover:text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {f.lido ? "Marcar não lido" : "Marcar lido"}
                  </button>
                  <ConfirmButton
                    action={() => excluirFeedback(slug, f.id)}
                    confirmText="Excluir esta avaliação?"
                    label="Excluir avaliação"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
