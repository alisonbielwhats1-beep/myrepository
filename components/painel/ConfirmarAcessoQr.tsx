"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  QrCode,
  UserRound,
  XCircle,
} from "lucide-react";
import { Aluno, DecisaoAcesso } from "@/lib/types";
import { badgeStatusMatricula, cn } from "@/lib/utils";
import { confirmarAcessoQr } from "@/app/painel/[slug]/recepcao/actions";

type AlunoResumo = Pick<
  Aluno,
  "id" | "nome" | "foto_perfil_url" | "status_matricula" | "matricula_codigo"
>;

function gerarChave(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Frase curta e segura para a tela de QR — nunca repete o `motivo` bruto de
 * `decidirAcesso()` quando ele veio da política financeira, porque esse texto
 * embute valor total vencido e dias de atraso (dado financeiro detalhado, que
 * esta tela não deve exibir). Motivo cadastral (matrícula trancada/cancelada)
 * não tem esse problema e pode ser mostrado como está.
 */
function motivoSeguro(decisao: DecisaoAcesso): string | null {
  if (decisao.politicaAplicada === null) return decisao.motivo;
  if (decisao.resultado === "bloqueado") {
    return "Bloqueado pela política de inadimplência da academia.";
  }
  return "Mensalidade em atraso — consulte o financeiro para detalhes.";
}

/** Rótulo/estilo curto do resultado — nunca mostra valores financeiros detalhados. */
function ResultadoBadge({ resultado }: { resultado: DecisaoAcesso["resultado"] }) {
  const cfg = {
    liberado: { estilo: "border-volt-500/30 bg-volt-500/10 text-volt-300", Icone: CheckCircle2, titulo: "Acesso liberado" },
    alerta: { estilo: "border-amber-500/40 bg-amber-500/10 text-amber-300", Icone: AlertTriangle, titulo: "Liberado com alerta" },
    bloqueado: { estilo: "border-red-500/40 bg-red-500/10 text-red-300", Icone: XCircle, titulo: "Acesso bloqueado" },
  }[resultado];

  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3", cfg.estilo)}>
      <cfg.Icone className="h-5 w-5 flex-none" />
      <span className="text-sm font-semibold">{cfg.titulo}</span>
    </div>
  );
}

export default function ConfirmarAcessoQr({
  slug,
  token,
  aluno,
  decisaoPreview,
}: {
  slug: string;
  token: string;
  aluno: AlunoResumo;
  decisaoPreview: DecisaoAcesso;
}) {
  const acao = confirmarAcessoQr.bind(null, slug, token);
  const [estado, formAction] = useFormState(acao, {});
  const [chave] = useState(() => gerarChave());

  const confirmado = estado.ok && estado.decisao;

  return (
    <div className="surface mx-auto max-w-sm space-y-5 rounded-2xl p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-ink-600">
          {aluno.foto_perfil_url ? (
            <Image
              src={aluno.foto_perfil_url}
              alt={aluno.nome}
              fill
              sizes="80px"
              className="media-native object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-ink-700 text-slate-500">
              <UserRound className="h-8 w-8" />
            </div>
          )}
        </div>
        <div>
          <p className="text-lg font-bold text-white">{aluno.nome}</p>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className={cn("chip", badgeStatusMatricula(aluno.status_matricula))}>
              {aluno.status_matricula}
            </span>
            {aluno.matricula_codigo && <span>Matrícula {aluno.matricula_codigo}</span>}
          </div>
        </div>
      </div>

      {!confirmado ? (
        <>
          <ResultadoBadge resultado={decisaoPreview.resultado} />
          {motivoSeguro(decisaoPreview) && (
            <p className="text-center text-xs text-slate-400">{motivoSeguro(decisaoPreview)}</p>
          )}

          <form action={formAction} className="space-y-3">
            <input type="hidden" name="chave_idempotencia" value={chave} />
            {estado.erro && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
                {estado.erro}
              </p>
            )}
            <BotaoConfirmar />
          </form>
        </>
      ) : (
        <>
          <ResultadoBadge resultado={estado.decisao!.resultado} />
          {motivoSeguro(estado.decisao!) && (
            <p className="text-center text-xs text-slate-400">{motivoSeguro(estado.decisao!)}</p>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <QrCode className="h-3.5 w-3.5" /> Entrada registrada no histórico da recepção.
          </p>
        </>
      )}
    </div>
  );
}

function BotaoConfirmar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-volt w-full disabled:opacity-50">
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      {pending ? "Confirmando..." : "Confirmar entrada"}
    </button>
  );
}
