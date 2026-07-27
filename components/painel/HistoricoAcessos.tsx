"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";
import { AcessoCatraca, Aluno, OrigemAcesso, StatusLiberacao } from "@/lib/types";
import { CORES_ORIGEM, cn, formatHora, timeAgo } from "@/lib/utils";

const RESULTADOS: { value: StatusLiberacao; label: string }[] = [
  { value: "liberado", label: "Liberado" },
  { value: "alerta", label: "Alerta" },
  { value: "negado", label: "Negado" },
];
const ORIGENS: OrigemAcesso[] = ["Direto", "Gympass", "TotalPass"];

/** Histórico de acessos da Recepção: filtros simples + paginação no servidor. */
export default function HistoricoAcessos({
  acessos,
  total,
  pagina,
  tamanhoPagina,
  alunos,
}: {
  acessos: AcessoCatraca[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  alunos: Aluno[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));

  const aplicar = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [chave, valor] of Object.entries(patch)) {
      if (valor) p.set(chave, valor);
      else p.delete(chave);
    }
    // Qualquer mudança de filtro volta para a página 1.
    if (!("pagina" in patch)) p.delete("pagina");
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  };

  return (
    <div className="surface rounded-2xl">
      <div className="border-b border-ink-700 px-5 py-4">
        <h2 className="font-semibold text-white">Histórico de acessos</h2>
        <p className="mt-0.5 text-xs text-slate-400">{total} registro(s) no total</p>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-end gap-3 border-b border-ink-700 px-5 py-3 transition-opacity",
          pending && "pointer-events-none opacity-60"
        )}
        aria-busy={pending}
      >
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-400">De</span>
          <input
            type="date"
            defaultValue={params.get("de") ?? ""}
            onChange={(e) => aplicar({ de: e.target.value || null })}
            className="inp !py-1.5 text-xs"
          />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Até</span>
          <input
            type="date"
            defaultValue={params.get("ate") ?? ""}
            onChange={(e) => aplicar({ ate: e.target.value || null })}
            className="inp !py-1.5 text-xs"
          />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Resultado</span>
          <select
            defaultValue={params.get("resultado") ?? ""}
            onChange={(e) => aplicar({ resultado: e.target.value || null })}
            className="inp !py-1.5 text-xs"
          >
            <option value="">Todos</option>
            {RESULTADOS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Origem</span>
          <select
            defaultValue={params.get("origem") ?? ""}
            onChange={(e) => aplicar({ origem: e.target.value || null })}
            className="inp !py-1.5 text-xs"
          >
            <option value="">Todas</option>
            {ORIGENS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="min-w-[160px] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Aluno</span>
          <select
            defaultValue={params.get("alunoId") ?? ""}
            onChange={(e) => aplicar({ alunoId: e.target.value || null })}
            className="inp !py-1.5 text-xs"
          >
            <option value="">Todos</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </label>
        {(params.get("de") || params.get("ate") || params.get("resultado") || params.get("origem") || params.get("alunoId")) && (
          <button
            type="button"
            onClick={() => aplicar({ de: null, ate: null, resultado: null, origem: null, alunoId: null })}
            className="btn-ghost !py-1.5 text-xs"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <ul className="divide-y divide-ink-700/70">
        {acessos.map((a) => {
          const alerta = a.status_liberacao === "alerta";
          // "alerta" é entrada PERMITIDA — não pode aparecer como negada.
          const liberado = a.status_liberacao === "liberado" || alerta;
          return (
            <li
              key={a.id}
              className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-700/30"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-ink-600">
                {a.aluno?.foto_perfil_url ? (
                  <Image
                    src={a.aluno.foto_perfil_url}
                    alt={a.aluno?.nome ?? "Aluno"}
                    fill
                    sizes="48px"
                    className="media-native object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
                    <UserRound className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {a.aluno?.nome ?? "Visitante"}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{
                      color: CORES_ORIGEM[a.origem],
                      backgroundColor: `${CORES_ORIGEM[a.origem]}1f`,
                    }}
                  >
                    <Zap className="h-3 w-3" />
                    {a.origem}
                  </span>
                  <span>{formatHora(a.data_hora_entrada)}</span>
                  <span className="text-slate-600">·</span>
                  <span>{timeAgo(a.data_hora_entrada)}</span>
                  {a.registrado_por && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span>registro manual</span>
                    </>
                  )}
                </div>
                {a.observacao && (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{a.observacao}</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    "chip",
                    alerta
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      : liberado
                      ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  )}
                >
                  {alerta ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" /> Alerta
                    </>
                  ) : liberado ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> Negado
                    </>
                  )}
                </span>
                {a.dias_atraso ? (
                  <span className="text-[10px] text-slate-500">
                    {a.dias_atraso} dia(s) de atraso
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}

        {acessos.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-5 py-12 text-slate-500">
            <DoorOpen className="h-8 w-8" />
            Nenhum acesso encontrado para os filtros selecionados.
          </li>
        )}
      </ul>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-ink-700 px-5 py-3">
          <span className="text-xs text-slate-500">
            Página {pagina} de {totalPaginas}
          </span>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => aplicar({ pagina: String(pagina - 1) })}
              disabled={pagina <= 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => aplicar({ pagina: String(pagina + 1) })}
              disabled={pagina >= totalPaginas}
              className="grid h-8 w-8 place-items-center rounded-lg border border-ink-600 text-slate-300 transition hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
