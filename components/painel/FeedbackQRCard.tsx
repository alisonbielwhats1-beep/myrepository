"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Printer, QrCode } from "lucide-react";

/**
 * Cartão com QR Code que leva à página pública de avaliação da academia.
 * O dono pode imprimir e deixar na recepção — qualquer pessoa escaneia e
 * envia um feedback (anônimo), sem precisar de login.
 */
export default function FeedbackQRCard({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/aluno/${slug}/feedback`
      : "";

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="surface flex flex-col items-center gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:gap-5">
      <div className="rounded-2xl bg-white p-3">
        <QRCodeSVG value={url || "https://"} size={132} level="M" />
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="flex items-center justify-center gap-2 font-semibold text-white sm:justify-start">
          <QrCode className="h-4 w-4 text-volt-300" /> QR de avaliação
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Imprima e deixe na recepção. Os alunos escaneiam e avaliam a academia
          em segundos, sem login.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <button onClick={copiar} className="btn-ghost">
            {copiado ? (
              <Check className="h-4 w-4 text-volt-300" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          <button onClick={() => window.print()} className="btn-ghost">
            <Printer className="h-4 w-4" /> Imprimir QR
          </button>
        </div>
      </div>
    </div>
  );
}
