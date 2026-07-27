"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import { origemPublica } from "@/lib/site-url";

/**
 * Cartão de acesso à recepção. O QR codifica uma URL interna que só um
 * membro autenticado da academia consegue abrir e confirmar
 * (/painel/[slug]/recepcao/qr/[token]) — nunca dados pessoais, nunca o
 * `aluno.id` (Bloco 1: antes gerava um JSON só no cliente que nenhum backend
 * validava). Sem expiração automática nesta primeira versão: o QR permanece
 * válido até a academia regenerá-lo pelo painel.
 */
export default function QRCodeCard({
  academiaSlug,
  tokenQrAcesso,
  matriculaCodigo,
}: {
  academiaSlug: string;
  tokenQrAcesso: string | null;
  matriculaCodigo: string | null;
}) {
  const url = useMemo(
    () =>
      tokenQrAcesso
        ? `${origemPublica()}/painel/${academiaSlug}/recepcao/qr/${tokenQrAcesso}`
        : null,
    [academiaSlug, tokenQrAcesso]
  );

  return (
    <div className="surface relative overflow-hidden rounded-3xl p-6 text-center shadow-card">
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-volt-500/15 blur-3xl" />

      <div className="relative">
        <p className="label-muted">Apresente na recepção</p>
        <h2 className="mt-1 text-xl font-bold text-white">Seu acesso</h2>

        {/* QR grande e centralizado */}
        <div className="relative mx-auto mt-6 w-fit">
          <span className="absolute inset-0 -z-0 rounded-3xl bg-volt-300/20 blur-xl" />
          <div className="relative rounded-3xl p-5" style={{ backgroundColor: "#ffffff" }}>
            {url ? (
              <QRCodeSVG
                value={url}
                size={220}
                level="M"
                bgColor="#ffffff"
                fgColor="#07080d"
                includeMargin={false}
              />
            ) : (
              <div className="grid h-[220px] w-[220px] place-items-center text-sm text-ink-950/60">
                QR indisponível
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-300">
          <ShieldCheck className="h-4 w-4 text-volt-300" />
          {url
            ? "Credencial de acesso — sem data de expiração"
            : "Peça à recepção para gerar seu QR de acesso"}
        </div>

        {matriculaCodigo && (
          <p className="mt-1 text-xs text-slate-500">
            Matrícula {matriculaCodigo}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-500">
          A academia pode gerar um novo QR a qualquer momento, invalidando
          este imediatamente.
        </p>
      </div>
    </div>
  );
}
