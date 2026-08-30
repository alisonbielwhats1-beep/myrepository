"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Wallet,
  X,
} from "lucide-react";
import { Aluno, FORMAS_PAGAMENTO, Plano, StatusFinanceiro } from "@/lib/types";
import { badgeStatusFinanceiro, rotuloStatusFinanceiro, cn, hojeSaoPaulo } from "@/lib/utils";
import { rotuloDiaVencimento } from "@/lib/vencimento";
import { cancelarCobranca, marcarPago } from "@/app/painel/[slug]/financeiro/actions";
import type { MensalidadeDetalhe } from "@/lib/data";

// ---------------------------------------------------------------------------
// Seção de situação financeira do aluno selecionado
// ---------------------------------------------------------------------------
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatComp(comp: string | null): string {
  if (!comp) return "—";
  const [y, m] = comp.split("-");
  return `${MESES[parseInt(m) - 1]}/${y.slice(2)}`;
}

function BotaoPago({ slug, receitaId }: { slug: string; receitaId: string }) {
  const [expandido, setExpandido] = useState(false);
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="rounded-md bg-volt-500/15 px-2 py-1 text-[10px] font-medium text-volt-300 transition hover:bg-volt-500/25"
      >
        Marcar pago
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <select
          value={forma}
          onChange={(e) => setForma(e.target.value)}
          className="h-6 rounded border border-ink-600 bg-ink-900 px-1 text-[10px] text-slate-200 focus:outline-none"
          autoFocus
        >
          <option value="">Forma…</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f.value} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          disabled={!forma || pending}
          onClick={() =>
            start(async () => {
              setErro(null);
              const resultado = await marcarPago(slug, receitaId, forma);
              if (resultado.erro) {
                setErro(resultado.erro);
                return;
              }
              setExpandido(false);
              setForma("");
            })
          }
          title="Confirmar pagamento"
          className="grid h-6 w-6 place-items-center rounded bg-volt-500/15 text-volt-300 transition hover:bg-volt-500/25 disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button
          onClick={() => { setExpandido(false); setForma(""); setErro(null); }}
          title="Fechar"
          className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:text-slate-300"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {erro && <p className="text-[10px] text-red-400">{erro}</p>}
    </div>
  );
}

function BotaoCancelar({ slug, receitaId }: { slug: string; receitaId: string }) {
  const [expandido, setExpandido] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pending, start] = useTransition();

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        className="rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-ink-700 hover:text-slate-300"
      >
        Cancelar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        placeholder="Motivo…"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="h-6 w-28 rounded border border-ink-600 bg-ink-900 px-1.5 text-[10px] text-slate-200 placeholder-slate-600 focus:outline-none"
        autoFocus
      />
      <button
        disabled={!motivo.trim() || pending}
        onClick={() =>
          start(async () => {
            await cancelarCobranca(slug, receitaId, motivo.trim());
            setExpandido(false);
            setMotivo("");
          })
        }
        title="Confirmar cancelamento"
        className="grid h-6 w-6 place-items-center rounded bg-red-500/15 text-red-400 transition hover:bg-red-500/25 disabled:opacity-40"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button
        onClick={() => { setExpandido(false); setMotivo(""); }}
        title="Cancelar"
        className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:text-slate-300"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function SituacaoFinanceira({
  sectionRef,
  slug,
  aluno,
  plano,
  mensalidades,
  statusFinanceiro,
}: {
  sectionRef: React.RefObject<HTMLDivElement>;
  slug: string;
  aluno: Aluno;
  plano: Plano | undefined;
  mensalidades: MensalidadeDetalhe[];
  statusFinanceiro: StatusFinanceiro | undefined;
}) {
  // Mesma referência de data da regra financeira e da decisão de acesso.
  const hoje = hojeSaoPaulo();
  const pendentes = mensalidades.filter((m) => m.status === "pendente");
  const totalAberto = pendentes.reduce((s, m) => s + Number(m.valor), 0);
  const vencMaisAntigo = pendentes.length
    ? pendentes.reduce((min, m) => (m.data < min ? m.data : min), pendentes[0].data)
    : null;
  const diasAtraso = vencMaisAntigo && vencMaisAntigo < hoje
    ? Math.floor((Date.now() - new Date(vencMaisAntigo + "T00:00:00").getTime()) / 86_400_000)
    : 0;

  const sorted = [...mensalidades].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pendente" ? -1 : 1;
    return b.data.localeCompare(a.data);
  });

  return (
    <div ref={sectionRef} className="surface rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Wallet className="h-4 w-4 text-volt-300" /> Situação financeira
        </h3>
        <a
          href={`/painel/${slug}/financeiro/receitas?aluno=${aluno.id}`}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Ir para Financeiro <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      {/* Resumo do plano */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="label-muted">Plano</p>
          <p className="mt-0.5 text-sm font-medium text-white truncate">
            {plano?.nome ?? <span className="text-slate-500">Sem plano</span>}
          </p>
        </div>
        <div>
          <p className="label-muted">Mensalidade</p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {plano ? plano.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          </p>
        </div>
        <div>
          <p className="label-muted">Vencimento</p>
          <p className="mt-0.5 text-sm font-medium text-white">
            {rotuloDiaVencimento(aluno.dia_vencimento)}
          </p>
        </div>
        <div>
          <p className="label-muted">Situação</p>
          <p className="mt-0.5">
            {statusFinanceiro ? (
              <span className={cn("chip text-[10px]", badgeStatusFinanceiro(statusFinanceiro))}>
                {rotuloStatusFinanceiro(statusFinanceiro)}
              </span>
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </p>
        </div>
      </div>

      {/* Alertas de inadimplência */}
      {pendentes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-red-300">
            <AlertCircle className="h-4 w-4 flex-none" />
            {pendentes.length} em aberto
          </span>
          <span className="text-red-200 tabular-nums">
            Total: {totalAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          {vencMaisAntigo && (
            <span className="text-red-300/80 text-xs">
              Mais antigo: {new Date(vencMaisAntigo + "T00:00:00").toLocaleDateString("pt-BR")}
              {diasAtraso > 0 && ` · ${diasAtraso} dias de atraso`}
            </span>
          )}
        </div>
      )}

      {/* Lista de mensalidades */}
      {mensalidades.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma mensalidade registrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-2 pr-4 font-medium">Competência</th>
                <th className="pb-2 pr-4 font-medium">Vencimento</th>
                <th className="pb-2 pr-4 font-medium">Valor</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/50">
              {sorted.map((m) => {
                const cancelada = m.status === "cancelada";
                return (
                  <tr key={m.id} className={cn("group", cancelada && "opacity-50")}>
                    <td className={cn("py-2 pr-4", cancelada ? "text-slate-600 line-through" : "text-slate-300")}>
                      {formatComp(m.competencia)}
                    </td>
                    <td className={cn("py-2 pr-4", cancelada ? "text-slate-600 line-through" : "text-slate-300")}>
                      {new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      {m.data_pagamento && (
                        <span className="block text-[10px] text-volt-300/70">
                          Pago {new Date(m.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                          {m.forma_pagamento && ` · ${m.forma_pagamento}`}
                        </span>
                      )}
                    </td>
                    <td className={cn("py-2 pr-4 tabular-nums", cancelada ? "text-slate-600 line-through" : "font-medium text-white")}>
                      {Number(m.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={cn(
                        "chip text-[10px]",
                        m.status === "pago"
                          ? "bg-volt-500/15 text-volt-300 border-volt-500/30"
                          : m.status === "cancelada"
                          ? "bg-slate-500/15 text-slate-500 border-slate-500/30"
                          : m.data < hoje
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      )}>
                        {m.status === "pago" ? "pago"
                          : m.status === "cancelada" ? "cancelada"
                          : m.data < hoje ? "vencida"
                          : "a vencer"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {m.status === "pendente" && (
                        <div className="flex items-center justify-end gap-1">
                          <BotaoPago slug={slug} receitaId={m.id} />
                          <BotaoCancelar slug={slug} receitaId={m.id} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
