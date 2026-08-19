"use client";

import { useState } from "react";
import { ChevronDown, Clock, QrCode, ScanLine } from "lucide-react";
import QRCodeCard from "./QRCodeCard";
import { cn } from "@/lib/utils";

/**
 * Aba "Acesso". O check-in por QR na catraca/recepção ainda está em construção,
 * então a tela NÃO vende isso como pronto: o destaque é um card elegante e
 * DESABILITADO ("Em implementação"). O QR que a recepção usa hoje continua
 * existindo — reaproveitado aqui num bloco discreto e recolhido, claramente
 * marcado como o método atual — para não quebrar o fluxo da academia real
 * enquanto a versão self-service não chega.
 */
export default function AcessoView({
  academiaSlug,
  tokenQrAcesso,
  matriculaCodigo,
}: {
  academiaSlug: string;
  tokenQrAcesso: string | null;
  matriculaCodigo: string | null;
}) {
  const [mostrarQr, setMostrarQr] = useState(false);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua entrada na academia</p>
        <h1 className="text-2xl font-bold text-white">Acesso</h1>
      </header>

      {/* Card principal — em implementação, desabilitado */}
      <div
        className="surface relative overflow-hidden rounded-3xl p-6"
        aria-disabled="true"
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-volt-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          {/* "QR" ilustrativo, não escaneável — sinaliza o recurso sem fingir que funciona */}
          <div className="relative">
            <div className="grid h-28 w-28 place-items-center rounded-3xl border border-ink-600 bg-ink-900/60">
              <QrCode className="h-14 w-14 text-slate-600" strokeWidth={1.5} />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
              Em implementação
            </span>
          </div>

          <h2 className="mt-6 text-lg font-bold text-white">Acesso por QR Code</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            Em breve você fará check-in na academia direto pelo app, apresentando
            seu QR na entrada. Estamos preparando essa experiência.
          </p>

          <button
            type="button"
            disabled
            className="btn-volt mt-5 w-full cursor-not-allowed opacity-40"
          >
            <ScanLine className="h-4 w-4" />
            Fazer check-in
          </button>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" /> Disponível em uma próxima atualização
          </p>
        </div>
      </div>

      {/* QR atual (interino), recolhido — o que a recepção já usa hoje */}
      {tokenQrAcesso && (
        <div className="surface overflow-hidden rounded-2xl">
          <button
            type="button"
            onClick={() => setMostrarQr((v) => !v)}
            aria-expanded={mostrarQr}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <QrCode className="h-4 w-4 text-slate-400" />
              Mostrar meu QR atual (usado hoje na recepção)
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 flex-none text-slate-500 transition",
                mostrarQr && "rotate-180"
              )}
            />
          </button>

          {mostrarQr && (
            <div className="border-t border-ink-600/60 p-4">
              <QRCodeCard
                academiaSlug={academiaSlug}
                tokenQrAcesso={tokenQrAcesso}
                matriculaCodigo={matriculaCodigo}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
