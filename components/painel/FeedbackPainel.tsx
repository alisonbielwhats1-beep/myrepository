"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  Check,
  Loader2,
  MessageSquare,
  Reply,
  Star,
  UserRound,
} from "lucide-react";
import {
  CATEGORIAS_FEEDBACK,
  Feedback,
  STATUS_FEEDBACK,
  StatusFeedback,
} from "@/lib/types";
import { cn, formatDataHoraCompleta, FUSO_ACADEMIA } from "@/lib/utils";
import ConfirmButton from "@/components/ui/ConfirmButton";
import {
  atualizarStatusFeedback,
  excluirFeedback,
  marcarFeedbackLido,
  responderFeedback,
} from "@/app/painel/[slug]/feedback/actions";

function rotuloCategoria(c: string | null): string {
  if (!c) return "Geral";
  return CATEGORIAS_FEEDBACK.find((x) => x.value === c)?.label ?? c;
}

/** Feedback anterior à migration 057 não tem status: trata como 'novo'. */
function statusDe(f: Feedback): StatusFeedback {
  return f.status ?? "novo";
}

const CLASSE_STATUS: Record<StatusFeedback, string> = {
  novo: "border-volt-500/30 bg-volt-500/10 text-volt-300",
  em_analise: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  respondido: "border-cyanx-500/30 bg-cyanx-500/10 text-cyanx-400",
  concluido: "border-ink-600 bg-ink-700/60 text-slate-400",
};

function rotuloStatus(s: StatusFeedback): string {
  return STATUS_FEEDBACK.find((x) => x.value === s)?.label ?? s;
}

export default function FeedbackPainel({
  slug,
  feedbacks,
}: {
  slug: string;
  feedbacks: Feedback[];
}) {
  const [filtro, setFiltro] = useState<"todos" | "nao_lidos" | "pendentes">(
    "todos"
  );
  const [lendoPending, startLendoTransition] = useTransition();
  const [lendoId, setLendoId] = useState<string | null>(null);

  const media = useMemo(() => {
    if (feedbacks.length === 0) return 0;
    return feedbacks.reduce((a, f) => a + f.nota, 0) / feedbacks.length;
  }, [feedbacks]);

  const naoLidos = feedbacks.filter((f) => !f.lido).length;
  // "Pendentes" é a fila de trabalho: tudo que ainda não foi concluído.
  const pendentes = feedbacks.filter((f) => statusDe(f) !== "concluido").length;
  const lista =
    filtro === "nao_lidos"
      ? feedbacks.filter((f) => !f.lido)
      : filtro === "pendentes"
        ? feedbacks.filter((f) => statusDe(f) !== "concluido")
        : feedbacks;

  return (
    <div className="space-y-5">
      {/* Resumo — 3 colunas fixas espremiam os cards em telas estreitas; em
          celular pequeno viram 1 coluna e a partir de 400px voltam a 3. */}
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-3 sm:gap-4">
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
            { v: "pendentes", l: `A tratar (${pendentes})` },
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
                  <span className={cn("chip", CLASSE_STATUS[statusDe(f)])}>
                    {rotuloStatus(statusDe(f))}
                  </span>
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

              <Tratamento slug={slug} feedback={f} />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ink-700 pt-3">
                <span className="text-xs text-slate-500">
                  {new Date(f.criado_em).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: FUSO_ACADEMIA,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={lendoPending && lendoId === f.id}
                    onClick={() => {
                      setLendoId(f.id);
                      startLendoTransition(async () => {
                        await marcarFeedbackLido(slug, f.id, !f.lido);
                      });
                    }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-ink-700 hover:text-white disabled:opacity-50"
                  >
                    {lendoPending && lendoId === f.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
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

/**
 * Tratamento do feedback: resposta única + movimentação na fila.
 *
 * Uma resposta só, de propósito — feedback não é chat. Se a academia
 * reescrever, substitui a anterior. Conversa com ida e volta é Atendimento.
 */
function Tratamento({ slug, feedback }: { slug: string; feedback: Feedback }) {
  const acao = responderFeedback.bind(null, slug, feedback.id);
  const [estado, formAction] = useFormState(acao, {});
  const [aberto, setAberto] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();
  const status = statusDe(feedback);

  return (
    <div className="mt-3 space-y-3">
      {feedback.resposta && (
        <div className="rounded-xl border border-ink-600 bg-ink-800/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Resposta da academia
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
            {feedback.resposta}
          </p>
          <p className="mt-2 text-[11px] text-slate-600">
            {feedback.respondido_por_nome ?? "Equipe"}
            {feedback.respondido_em &&
              ` · ${formatDataHoraCompleta(feedback.respondido_em)}`}
          </p>
        </div>
      )}

      {/* Fila de tratamento. O aluno vê a resposta, não o status. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-600">
          Situação
        </span>
        {STATUS_FEEDBACK.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={statusPending || s.value === status}
            onClick={() =>
              startStatusTransition(async () => {
                await atualizarStatusFeedback(slug, feedback.id, s.value);
              })
            }
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-medium transition disabled:cursor-default",
              s.value === status
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:bg-ink-700 hover:text-slate-200 disabled:opacity-50"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-ink-700 hover:text-white"
        >
          <Reply className="h-3.5 w-3.5" />
          {feedback.resposta ? "Editar resposta" : "Responder feedback"}
        </button>
      ) : (
        <form action={formAction} className="space-y-2" key={estado.savedAt}>
          <textarea
            name="resposta"
            rows={3}
            required
            maxLength={2000}
            defaultValue={feedback.resposta ?? ""}
            placeholder="Escreva a resposta que o aluno vai ver na área dele."
            className="inp resize-y"
          />
          {estado.erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {estado.erro}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="btn-ghost !py-1.5 text-xs"
            >
              Cancelar
            </button>
            <BotaoResponder />
          </div>
        </form>
      )}
    </div>
  );
}

function BotaoResponder() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-volt ml-auto !py-1.5 text-xs"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Reply className="h-3.5 w-3.5" />
      )}
      {pending ? "Enviando..." : "Salvar resposta"}
    </button>
  );
}
