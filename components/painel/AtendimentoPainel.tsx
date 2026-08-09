"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, MessagesSquare, Reply, UserRound } from "lucide-react";
import {
  Atendimento,
  CATEGORIAS_ATENDIMENTO,
  STATUS_ATENDIMENTO,
  StatusAtendimento,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  atualizarStatusAtendimento,
  responderAtendimento,
} from "@/app/painel/[slug]/atendimento/actions";

const CLASSE_STATUS: Record<StatusAtendimento, string> = {
  novo: "border-volt-500/30 bg-volt-500/10 text-volt-300",
  em_atendimento: "border-cyanx-500/30 bg-cyanx-500/10 text-cyanx-400",
  aguardando_aluno: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  resolvido: "border-ink-600 bg-ink-700/60 text-slate-400",
};

function rotulo<T extends string>(
  lista: { value: T; label: string }[],
  v: T
): string {
  return lista.find((x) => x.value === v)?.label ?? v;
}

export default function AtendimentoPainel({
  slug,
  atendimentos,
}: {
  slug: string;
  atendimentos: Atendimento[];
}) {
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");

  const abertos = atendimentos.filter((a) => a.status !== "resolvido");
  const lista = filtro === "abertos" ? abertos : atendimentos;

  return (
    <div className="space-y-5">
      <div className="inline-flex gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1">
        {(
          [
            { v: "abertos", l: `Em aberto (${abertos.length})` },
            { v: "todos", l: `Todos (${atendimentos.length})` },
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

      {lista.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          <MessagesSquare className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          {atendimentos.length === 0
            ? "Nenhuma solicitação ainda. Os alunos abrem atendimento pela área deles."
            : "Nenhuma solicitação em aberto. 🎉"}
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((t) => (
            <Ticket key={t.id} slug={slug} atendimento={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Ticket({ slug, atendimento }: { slug: string; atendimento: Atendimento }) {
  const acao = responderAtendimento.bind(null, slug, atendimento.id);
  const [estado, formAction] = useFormState(acao, {});
  const [aberto, setAberto] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();

  return (
    <li className="surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{atendimento.assunto}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <UserRound className="h-3.5 w-3.5" />
            {atendimento.aluno?.nome ?? "Aluno removido"}
            <span aria-hidden="true">·</span>
            {rotulo(CATEGORIAS_ATENDIMENTO, atendimento.categoria)}
            <span aria-hidden="true">·</span>
            {new Date(atendimento.criado_em).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <span className={cn("chip flex-none", CLASSE_STATUS[atendimento.status])}>
          {rotulo(STATUS_ATENDIMENTO, atendimento.status)}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {atendimento.mensagens.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-xl border p-3",
              m.autor_tipo === "aluno"
                ? "border-ink-600 bg-ink-800/60"
                : "border-volt-500/25 bg-volt-500/5"
            )}
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {m.autor_tipo === "aluno" ? m.autor_nome : `${m.autor_nome} · academia`}
              {" · "}
              {new Date(m.criado_em).toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
              {m.mensagem}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-700 pt-3">
        <span className="text-[11px] uppercase tracking-wide text-slate-600">
          Situação
        </span>
        {STATUS_ATENDIMENTO.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={statusPending || s.value === atendimento.status}
            onClick={() =>
              startStatusTransition(async () => {
                await atualizarStatusAtendimento(slug, atendimento.id, s.value);
              })
            }
            className={cn(
              "rounded-lg px-2 py-1 text-xs font-medium transition disabled:cursor-default",
              s.value === atendimento.status
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
          className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-ink-700 hover:text-white"
        >
          <Reply className="h-3.5 w-3.5" /> Responder
        </button>
      ) : (
        <form action={formAction} className="mt-3 space-y-2" key={estado.savedAt}>
          <textarea
            name="mensagem"
            rows={3}
            required
            maxLength={2000}
            placeholder="Escreva a resposta para o aluno."
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
            <BotaoEnviar />
          </div>
        </form>
      )}
    </li>
  );
}

function BotaoEnviar() {
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
      {pending ? "Enviando..." : "Enviar resposta"}
    </button>
  );
}
