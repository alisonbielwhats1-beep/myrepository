"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2, MessagesSquare, Plus, Send } from "lucide-react";
import {
  AtendimentoDoAluno,
  CATEGORIAS_ATENDIMENTO,
  STATUS_ATENDIMENTO,
  StatusAtendimento,
} from "@/lib/types";
import { cn, formatDataDeInstante, formatDataHoraCompleta } from "@/lib/utils";

type EstadoAcaoAluno = { erro?: string; ok?: boolean; savedAt?: number };
type AcaoForm = (
  estado: EstadoAcaoAluno,
  formData: FormData
) => Promise<EstadoAcaoAluno>;
type AcaoResponder = (
  slug: string,
  token: string,
  atendimentoId: string,
  estado: EstadoAcaoAluno,
  formData: FormData
) => Promise<EstadoAcaoAluno>;

const CLASSE_STATUS: Record<StatusAtendimento, string> = {
  novo: "border-volt-500/30 bg-volt-500/10 text-volt-300",
  em_atendimento: "border-cyanx-500/30 bg-cyanx-500/10 text-cyanx-400",
  aguardando_aluno: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  resolvido: "border-ink-600 bg-ink-700/60 text-slate-400",
};

function rotuloStatus(s: StatusAtendimento): string {
  return STATUS_ATENDIMENTO.find((x) => x.value === s)?.label ?? s;
}

/**
 * Área do aluno: abrir solicitação e acompanhar as respostas da academia.
 *
 * Não é chat — a página busca as mensagens no carregamento e revalida depois
 * de enviar. Sem polling, sem websocket.
 */
export default function AtendimentoAluno({
  slug,
  token,
  atendimentos,
  abrir,
  responder,
}: {
  slug: string;
  token: string;
  atendimentos: AtendimentoDoAluno[];
  abrir: AcaoForm;
  responder: AcaoResponder;
}) {
  const [estado, formAction] = useFormState(abrir, {});
  const [aberto, setAberto] = useState(atendimentos.length === 0);

  return (
    <div className="space-y-6">
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="btn-volt w-full justify-center"
        >
          <Plus className="h-4 w-4" /> Nova solicitação
        </button>
      ) : (
        <form
          action={formAction}
          className="surface space-y-3 rounded-2xl p-4"
          key={estado.savedAt}
        >
          <h2 className="font-semibold text-white">Nova solicitação</h2>

          <label className="block">
            <span className="label-muted">Categoria</span>
            <select name="categoria" required className="inp mt-1" defaultValue="">
              <option value="" disabled>
                Escolha…
              </option>
              {CATEGORIAS_ATENDIMENTO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label-muted">Assunto</span>
            <input
              name="assunto"
              required
              maxLength={120}
              placeholder="Resuma em poucas palavras"
              className="inp mt-1"
            />
          </label>

          <label className="block">
            <span className="label-muted">Mensagem</span>
            <textarea
              name="mensagem"
              required
              rows={4}
              maxLength={2000}
              placeholder="Conte o que você precisa."
              className="inp mt-1 resize-y"
            />
          </label>

          {estado.erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {estado.erro}
            </p>
          )}
          {estado.ok && (
            <p className="rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-300">
              Solicitação enviada. A academia responde por aqui.
            </p>
          )}

          <div className="flex items-center gap-2">
            {atendimentos.length > 0 && (
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="btn-ghost"
              >
                Cancelar
              </button>
            )}
            <Enviar label="Enviar solicitação" />
          </div>
        </form>
      )}

      {atendimentos.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          <MessagesSquare className="mx-auto mb-2 h-8 w-8 text-slate-500" />
          Você ainda não abriu nenhuma solicitação.
        </div>
      ) : (
        <ul className="space-y-3">
          {atendimentos.map((t) => (
            <Ticket
              key={t.id}
              slug={slug}
              token={token}
              atendimento={t}
              responder={responder}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Ticket({
  slug,
  token,
  atendimento,
  responder,
}: {
  slug: string;
  token: string;
  atendimento: AtendimentoDoAluno;
  responder: AcaoResponder;
}) {
  // O bind acontece aqui, no cliente: o servidor passou a referência da Server
  // Action, não uma closure já ligada ao id.
  const acao = responder.bind(null, slug, token, atendimento.id);
  const [estado, formAction] = useFormState(acao, {});

  return (
    <li className="surface rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{atendimento.assunto}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {CATEGORIAS_ATENDIMENTO.find((c) => c.value === atendimento.categoria)
              ?.label ?? atendimento.categoria}
            {" · "}
            {formatDataDeInstante(atendimento.criado_em)}
          </p>
        </div>
        <span className={cn("chip flex-none", CLASSE_STATUS[atendimento.status])}>
          {rotuloStatus(atendimento.status)}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {atendimento.mensagens.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-xl border p-3",
              m.autor_tipo === "academia"
                ? "border-volt-500/25 bg-volt-500/5"
                : "border-ink-600 bg-ink-800/60"
            )}
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {m.autor_tipo === "academia" ? "Academia" : "Você"}
              {" · "}
              {formatDataHoraCompleta(m.criado_em)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
              {m.mensagem}
            </p>
          </li>
        ))}
      </ul>

      {atendimento.status === "resolvido" ? (
        <p className="mt-3 border-t border-ink-700 pt-3 text-xs text-slate-500">
          Atendimento resolvido. Precisa de mais alguma coisa? Abra uma nova
          solicitação.
        </p>
      ) : (
        <form
          action={formAction}
          className="mt-3 space-y-2 border-t border-ink-700 pt-3"
          key={estado.savedAt}
        >
          <textarea
            name="mensagem"
            rows={3}
            required
            maxLength={2000}
            placeholder="Responder…"
            className="inp resize-y"
          />
          {estado.erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {estado.erro}
            </p>
          )}
          <Enviar label="Enviar" />
        </form>
      )}
    </li>
  );
}

function Enviar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt ml-auto">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {pending ? "Enviando..." : label}
    </button>
  );
}
