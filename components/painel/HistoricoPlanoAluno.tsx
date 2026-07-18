"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { HistoricoPlano } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { renovarPlano } from "@/app/painel/[slug]/alunos/actions";

function periodoLabel(meses: number): string {
  if (meses === 1) return "mensal";
  if (meses === 12) return "anual";
  return `${meses} meses`;
}

/** Calcula a próxima renovação a partir do início do plano atual + recorrência. */
function proximaRenovacao(inicioISO: string, recorrenciaMeses: number): Date {
  const inicio = new Date(inicioISO + "T00:00:00");
  const prox = new Date(inicio);
  const hoje = new Date();
  // Avança em blocos de `recorrenciaMeses` até passar de hoje.
  let guard = 0;
  while (prox <= hoje && guard < 600) {
    prox.setMonth(prox.getMonth() + Math.max(1, recorrenciaMeses));
    guard++;
  }
  return prox;
}

export default function HistoricoPlanoAluno({
  slug,
  alunoId,
  registros,
}: {
  slug: string;
  alunoId: string;
  registros: HistoricoPlano[];
}) {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const atual = registros[0] ?? null;
  const prox = atual
    ? proximaRenovacao(atual.data_inicio, atual.recorrencia_meses)
    : null;

  const renovar = () => {
    setMsg(null);
    iniciar(async () => {
      const r = await renovarPlano(slug, alunoId);
      setMsg(r.erro ?? "Plano renovado — novo ciclo registrado.");
    });
  };

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <CalendarClock className="h-4 w-4 text-volt-300" /> Plano & renovação
        </h3>
        {atual && (
          <button onClick={renovar} disabled={pendente} className="btn-ghost">
            {pendente ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Renovar agora
          </button>
        )}
      </div>

      {!atual ? (
        <p className="mt-3 text-sm text-slate-500">
          Nenhum plano registrado. Defina o plano no cadastro do aluno.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Info label="Plano atual" valor={atual.plano_nome} />
            <Info
              label="Valor"
              valor={`${formatBRL(atual.valor)} / ${periodoLabel(atual.recorrencia_meses)}`}
            />
            <Info
              label="Próxima renovação"
              valor={prox!.toLocaleDateString("pt-BR")}
            />
          </div>

          {registros.length > 1 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Histórico
              </p>
              <ul className="space-y-1.5">
                {registros.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-slate-300">{h.plano_nome}</span>
                    <span className="flex-none text-xs text-slate-500">
                      {new Date(h.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                      {" · "}
                      {formatBRL(h.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {msg && <p className="mt-3 text-xs text-slate-400">{msg}</p>}
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{valor}</p>
    </div>
  );
}
