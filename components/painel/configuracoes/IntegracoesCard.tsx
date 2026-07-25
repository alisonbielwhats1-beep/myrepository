"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import {
  rotarSecretIntegracao,
  atualizarStatusIntegracao,
} from "@/app/painel/[slug]/integracoes/actions";
import {
  type StatusIntegracao,
  LABELS_STATUS_INTEGRACAO,
} from "@/lib/types";

const STATUS_OPTIONS: StatusIntegracao[] = [
  "nao_configurada",
  "aguardando_configuracao",
  "aguardando_homologacao",
  "em_testes",
  "ativa",
  "com_erro",
  "desativada",
];

const DISCLAIMER =
  "Estrutura preparada para integração, sujeita à liberação e homologação da plataforma parceira.";

interface Props {
  slug: string;
  baseUrl: string;
  gympassSecretMascarado: string;
  gympassStatus: StatusIntegracao;
  totalpassSecretMascarado: string;
  totalpassStatus: StatusIntegracao;
}

export default function IntegracoesCard({
  slug,
  baseUrl,
  gympassSecretMascarado,
  gympassStatus,
  totalpassSecretMascarado,
  totalpassStatus,
}: Props) {
  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="font-semibold text-white">Integrações de parceiros</h2>
      <p className="mt-1 text-sm text-slate-400">
        Cole a URL do webhook no painel de cada parceiro para registrar check-ins
        automaticamente. O segredo é gerenciado com segurança — acesse a página de
        Integrações para detalhes completos.
      </p>

      <div className="mt-5 space-y-5">
        <PlataformaCard
          slug={slug}
          nome="Gympass"
          cor="#3ee6ff"
          plataforma="gympass"
          webhookUrl={`${baseUrl}/api/webhook/gympass/${slug}`}
          secretMascarado={gympassSecretMascarado}
          statusInicial={gympassStatus}
          instrucoes="No portal de parceiros do Gympass, vá em Configurações → Webhook e cole a URL abaixo."
          linkParceiro="https://partners.gympass.com"
        />
        <PlataformaCard
          slug={slug}
          nome="TotalPass"
          cor="#f81cc0"
          plataforma="totalpass"
          webhookUrl={`${baseUrl}/api/webhook/totalpass/${slug}`}
          secretMascarado={totalpassSecretMascarado}
          statusInicial={totalpassStatus}
          instrucoes="No painel da TotalPass para academias, vá em Integrações → Webhook e cole a URL abaixo."
          linkParceiro="https://academia.totalpass.com"
        />
      </div>
    </div>
  );
}

function PlataformaCard({
  slug,
  nome,
  cor,
  plataforma,
  webhookUrl,
  secretMascarado,
  statusInicial,
  instrucoes,
  linkParceiro,
}: {
  slug: string;
  nome: string;
  cor: string;
  plataforma: "gympass" | "totalpass";
  webhookUrl: string;
  secretMascarado: string;
  statusInicial: StatusIntegracao;
  instrucoes: string;
  linkParceiro: string;
}) {
  const [pendingRotar, startRotar] = useTransition();
  const [pendingStatus, startStatus] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiouUrl, setCopiouUrl] = useState(false);
  const [statusLocal, setStatusLocal] = useState<StatusIntegracao>(statusInicial);

  function copiarUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopiouUrl(true);
      setTimeout(() => setCopiouUrl(false), 2000);
    });
  }

  function rotacionar() {
    if (
      !window.confirm(
        `Gerar novo segredo para ${nome}?\n\nO segredo atual deixará de funcionar imediatamente. Você precisará atualizar o segredo no painel da ${nome} após isso.`
      )
    )
      return;

    setErro(null);
    startRotar(async () => {
      const res = await rotarSecretIntegracao(slug, plataforma);
      if (res.erro) setErro(res.erro);
    });
  }

  function salvarStatus(novoStatus: StatusIntegracao) {
    setStatusLocal(novoStatus);
    setErro(null);
    startStatus(async () => {
      const res = await atualizarStatusIntegracao(slug, plataforma, novoStatus);
      if (res.erro) {
        setErro(res.erro);
        setStatusLocal(statusInicial);
      }
    });
  }

  const naoAtiva = statusLocal !== "ativa";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: `${cor}30`, backgroundColor: `${cor}08` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold" style={{ color: cor }}>
          {nome}
        </span>
        <a
          href={linkParceiro}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          Portal do parceiro <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {naoAtiva && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-none text-amber-400" />
          <span>{DISCLAIMER}</span>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-400">{instrucoes}</p>

      <div className="mt-3 space-y-2">
        {/* URL do webhook — cópia permitida */}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            URL do webhook
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2">
            <code className="flex-1 truncate text-xs text-slate-300">{webhookUrl}</code>
            <button
              onClick={copiarUrl}
              className="shrink-0 text-slate-400 hover:text-white"
              title="Copiar URL"
            >
              {copiouUrl ? (
                <Check className="h-4 w-4 text-volt-300" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Segredo mascarado — sem botão de cópia */}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Segredo (Bearer token)
          </p>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2">
            <code className="text-xs tracking-widest text-slate-400">
              {secretMascarado || "Não configurado"}
            </code>
            <span className="text-[10px] text-slate-600">
              {secretMascarado ? "últimos 4 dígitos" : "use Integrações para gerar"}
            </span>
          </div>
        </div>

        {/* Status da integração */}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Status
          </p>
          <select
            value={statusLocal}
            onChange={(e) => salvarStatus(e.target.value as StatusIntegracao)}
            disabled={pendingStatus}
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-volt-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {LABELS_STATUS_INTEGRACAO[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      <button
        onClick={rotacionar}
        disabled={pendingRotar}
        className="btn-ghost mt-3 text-xs"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pendingRotar ? "animate-spin" : ""}`} />
        {pendingRotar ? "Gerando..." : "Gerar novo segredo"}
      </button>
    </div>
  );
}
