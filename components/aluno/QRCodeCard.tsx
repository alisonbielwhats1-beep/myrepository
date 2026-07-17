"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ShieldCheck } from "lucide-react";

/**
 * Cartão de acesso à catraca: gera um QR Code grande e centralizado com um
 * token dinâmico que rotaciona periodicamente (evita "print" reutilizável).
 */
export default function QRCodeCard({
  alunoId,
  academiaSlug,
  matriculaCodigo,
}: {
  alunoId: string;
  academiaSlug: string;
  matriculaCodigo: string | null;
}) {
  const CICLO_SEGUNDOS = 30;
  const [seg, setSeg] = useState(CICLO_SEGUNDOS);
  const [nonce, setNonce] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setSeg((s) => {
        if (s <= 1) {
          setNonce(Date.now());
          return CICLO_SEGUNDOS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const payload = useMemo(
    () =>
      JSON.stringify({
        v: 1,
        academia: academiaSlug,
        aluno: alunoId,
        t: nonce,
      }),
    [academiaSlug, alunoId, nonce]
  );

  const regenerar = () => {
    setNonce(Date.now());
    setSeg(CICLO_SEGUNDOS);
  };

  return (
    <div className="surface relative overflow-hidden rounded-3xl p-6 text-center shadow-card">
      <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-volt-500/15 blur-3xl" />

      <div className="relative">
        <p className="label-muted">Aproxime na catraca</p>
        <h2 className="mt-1 text-xl font-bold text-white">Seu acesso rápido</h2>

        {/* QR grande e centralizado */}
        <div className="relative mx-auto mt-6 w-fit">
          <span className="absolute inset-0 -z-0 rounded-3xl bg-volt-300/20 blur-xl" />
          <div className="relative rounded-3xl bg-white p-5">
            <QRCodeSVG
              value={payload}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#07080d"
              includeMargin={false}
            />
          </div>
          {/* anel pulsante de "ativo" */}
          <span className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-volt-300/50 animate-pulse-ring" />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-300">
          <ShieldCheck className="h-4 w-4 text-volt-300" />
          Código válido — expira em{" "}
          <span className="font-semibold text-volt-300">{seg}s</span>
        </div>

        {matriculaCodigo && (
          <p className="mt-1 text-xs text-slate-500">
            Matrícula {matriculaCodigo}
          </p>
        )}

        <button onClick={regenerar} className="btn-ghost mt-5 w-full">
          <RefreshCw className="h-4 w-4" /> Gerar novo código
        </button>
      </div>
    </div>
  );
}
