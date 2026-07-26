"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Loader2,
  Plus,
  UserRound,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { AcessoCatraca, Aluno, DecisaoAcesso } from "@/lib/types";
import { CORES_ORIGEM, cn, formatBRL, formatHora, timeAgo } from "@/lib/utils";
import { registrarAcesso } from "@/app/painel/[slug]/recepcao/actions";

/** Log de acessos da catraca — lista real, com registro manual de entrada. */
export default function CatracaLog({
  acessosIniciais,
  alunos,
  slug,
}: {
  acessosIniciais: AcessoCatraca[];
  alunos: Aluno[];
  slug: string;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);

  return (
    <div className="surface rounded-2xl">
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-volt-300" />
          </span>
          <h2 className="font-semibold text-white">Acessos</h2>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className={mostrarForm ? "btn-ghost" : "btn-volt"}
          disabled={alunos.length === 0}
          title={alunos.length === 0 ? "Cadastre um aluno primeiro" : undefined}
        >
          {mostrarForm ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {mostrarForm ? "Fechar" : "Registrar entrada"}
        </button>
      </div>

      {mostrarForm && (
        <FormularioAcesso
          slug={slug}
          alunos={alunos}
          onSalvo={() => setMostrarForm(false)}
        />
      )}

      <ul className="divide-y divide-ink-700/70">
        {acessosIniciais.map((a) => {
          const alerta = a.status_liberacao === "alerta";
          // "alerta" é entrada permitida — não pode aparecer como negada.
          const liberado = a.status_liberacao === "liberado" || alerta;
          return (
            <li
              key={a.id}
              className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-ink-700/30"
            >
              {/* Foto do aluno — sem retângulo de fundo poluindo a mídia */}
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
                </div>
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

        {acessosIniciais.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-5 py-12 text-slate-500">
            <DoorOpen className="h-8 w-8" />
            Nenhum acesso registrado ainda.
          </li>
        )}
      </ul>
    </div>
  );
}

function FormularioAcesso({
  slug,
  alunos,
  onSalvo,
}: {
  slug: string;
  alunos: Aluno[];
  onSalvo: () => void;
}) {
  const acao = registrarAcesso.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

  // Só fecha o formulário quando a entrada foi liberada sem ressalva. Com alerta
  // ou bloqueio, o painel permanece aberto para a recepção ler o motivo.
  useEffect(() => {
    if (estado.ok && estado.decisao?.resultado === "liberado") onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 border-b border-ink-700 bg-ink-900/40 px-5 py-4"
    >
      {estado.erro && (
        <p className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      {estado.decisao && <PainelDecisao decisao={estado.decisao} />}
      <label className="min-w-[220px] flex-1">
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Aluno
        </span>
        <select name="aluno_id" className="inp" required defaultValue="">
          <option value="" disabled>
            Selecione...
          </option>
          {alunos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-400">
          Origem
        </span>
        <select name="origem" className="inp" defaultValue="Direto">
          <option value="Direto">Direto</option>
          <option value="Gympass">Gympass</option>
          <option value="TotalPass">TotalPass</option>
        </select>
      </label>
      <BotaoRegistrar />
    </form>
  );
}

/**
 * Resultado da tentativa de entrada. Verde = liberado, amarelo = liberado com
 * pendência financeira, vermelho = bloqueado pela política da academia.
 */
function PainelDecisao({ decisao }: { decisao: DecisaoAcesso }) {
  const { resultado } = decisao;

  const estilo =
    resultado === "liberado"
      ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
      : resultado === "alerta"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : "border-red-500/40 bg-red-500/10 text-red-300";

  const Icone =
    resultado === "liberado"
      ? CheckCircle2
      : resultado === "alerta"
      ? AlertTriangle
      : XCircle;

  const titulo =
    resultado === "liberado"
      ? "Acesso permitido"
      : resultado === "alerta"
      ? "Acesso permitido — aluno com mensalidade vencida"
      : "Acesso bloqueado";

  // Só há detalhamento financeiro quando a decisão passou pela política.
  const temFinanceiro = decisao.quantidadeVencida > 0;

  return (
    <div className={cn("w-full rounded-xl border px-4 py-3", estilo)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icone className="h-4 w-4 flex-none" />
        {titulo}
      </p>

      {resultado === "bloqueado" && decisao.politicaAplicada === null && decisao.motivo && (
        <p className="mt-1 text-xs opacity-90">{decisao.motivo}</p>
      )}

      {temFinanceiro && (
        <>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
            <div>
              <span className="block opacity-70">Total vencido</span>
              <span className="font-semibold tabular-nums">
                {formatBRL(decisao.totalVencido)}
              </span>
            </div>
            <div>
              <span className="block opacity-70">Mensalidades</span>
              <span className="font-semibold tabular-nums">
                {decisao.quantidadeVencida}
              </span>
            </div>
            <div>
              <span className="block opacity-70">Competência mais antiga</span>
              <span className="font-semibold">
                {decisao.competencia
                  ? new Date(decisao.competencia + "T00:00:00").toLocaleDateString(
                      "pt-BR",
                      { month: "2-digit", year: "numeric" }
                    )
                  : "—"}
              </span>
            </div>
            <div>
              <span className="block opacity-70">Vencimento</span>
              <span className="font-semibold">
                {decisao.vencimento
                  ? new Date(decisao.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}
                {decisao.diasAtraso > 0 && ` · ${decisao.diasAtraso} dia(s)`}
              </span>
            </div>
          </div>

          {resultado === "bloqueado" && (
            <p className="mt-2.5 text-xs opacity-90">
              O bloqueio ocorreu pela política de inadimplência configurada nas
              Configurações da academia. A tentativa ficou registrada no histórico.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function BotaoRegistrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {pending ? "Registrando..." : "Registrar"}
    </button>
  );
}
