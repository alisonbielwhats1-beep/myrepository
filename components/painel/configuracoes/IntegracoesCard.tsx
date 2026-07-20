"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { rotarSecretWebhook } from "@/app/painel/[slug]/configuracoes/actions";

interface Props {
  slug: string;
  baseUrl: string;
  gympassSecret: string;
  totalpassSecret: string;
}

export default function IntegracoesCard({
  slug,
  baseUrl,
  gympassSecret,
  totalpassSecret,
}: Props) {
  return (
    <div className="surface rounded-2xl p-5">
      <h2 className="font-semibold text-white">Integrações de parceiros</h2>
      <p className="mt-1 text-sm text-slate-400">
        Cole a URL e o segredo no painel de cada parceiro para eles enviarem os
        check-ins automaticamente.
      </p>

      <div className="mt-5 space-y-5">
        <PlataformaCard
          slug={slug}
          nome="Gympass"
          cor="#3ee6ff"
          plataforma="gympass"
          webhookUrl={`${baseUrl}/api/webhook/gympass/${slug}`}
          secret={gympassSecret}
          instrucoes="No portal de parceiros do Gympass, vá em Configurações → Webhook e cole a URL e o segredo abaixo."
          linkParceiro="https://partners.gympass.com"
        />
        <PlataformaCard
          slug={slug}
          nome="TotalPass"
          cor="#f81cc0"
          plataforma="totalpass"
          webhookUrl={`${baseUrl}/api/webhook/totalpass/${slug}`}
          secret={totalpassSecret}
          instrucoes="No painel da TotalPass para academias, vá em Integrações → Webhook e cole a URL e o segredo abaixo."
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
  secret,
  instrucoes,
  linkParceiro,
}: {
  slug: string;
  nome: string;
  cor: string;
  plataforma: "gympass" | "totalpass";
  webhookUrl: string;
  secret: string;
  instrucoes: string;
  linkParceiro: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiouUrl, setCopiouUrl] = useState(false);
  const [copiouSecret, setCopiouSecret] = useState(false);

  function copiar(texto: string, setSucesso: (v: boolean) => void) {
    navigator.clipboard.writeText(texto).then(() => {
      setSucesso(true);
      setTimeout(() => setSucesso(false), 2000);
    });
  }

  function rotacionar() {
    if (
      !window.confirm(
        `Gerar novo segredo para ${nome}?\n\nVocê precisará atualizar o segredo no painel da ${nome} após isso.`
      )
    )
      return;

    setErro(null);
    startTransition(async () => {
      const res = await rotarSecretWebhook(slug, plataforma);
      if (res.erro) setErro(res.erro);
    });
  }

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

      <p className="mt-2 text-xs text-slate-400">{instrucoes}</p>

      <div className="mt-3 space-y-2">
        {/* URL do webhook */}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            URL do webhook
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2">
            <code className="flex-1 truncate text-xs text-slate-300">
              {webhookUrl}
            </code>
            <button
              onClick={() => copiar(webhookUrl, setCopiouUrl)}
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

        {/* Segredo */}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Segredo (Bearer token)
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-950 px-3 py-2">
            <code className="flex-1 truncate text-xs text-slate-300">
              {secret}
            </code>
            <button
              onClick={() => copiar(secret, setCopiouSecret)}
              className="shrink-0 text-slate-400 hover:text-white"
              title="Copiar segredo"
            >
              {copiouSecret ? (
                <Check className="h-4 w-4 text-volt-300" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {erro}
        </p>
      )}

      <button
        onClick={rotacionar}
        disabled={pending}
        className="btn-ghost mt-3 text-xs"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Gerando..." : "Gerar novo segredo"}
      </button>
    </div>
  );
}
