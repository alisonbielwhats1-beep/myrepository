"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Download, QrCode, Share2, X } from "lucide-react";
import { Treino } from "@/lib/types";
import { definirPublicoTreino } from "@/app/painel/[slug]/treinos/actions";

export default function CompartilharTreino({
  slug,
  treino,
}: {
  slug: string;
  treino: Treino;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="btn-ghost"
        title="Compartilhar treino por QR"
      >
        <Share2 className="h-4 w-4" /> Compartilhar
      </button>
      {aberto &&
        createPortal(
          <Dialog slug={slug} treino={treino} onClose={() => setAberto(false)} />,
          document.body
        )}
    </>
  );
}

function Dialog({
  slug,
  treino,
  onClose,
}: {
  slug: string;
  treino: Treino;
  onClose: () => void;
}) {
  const [publico, setPublico] = useState(treino.publico);
  const [pending, start] = useTransition();
  const [copiado, setCopiado] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/treino/${treino.share_token}`
      : "";

  const alternarPublico = () => {
    const novo = !publico;
    setPublico(novo);
    start(() => definirPublicoTreino(slug, treino.id, novo));
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  const baixarQR = () => {
    const canvas = document.getElementById("qr-treino") as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `treino-${treino.nome_treino.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="surface-strong relative w-full max-w-sm rounded-3xl p-6 text-center">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center justify-center gap-2 text-volt-300">
          <QrCode className="h-5 w-5" />
          <h3 className="font-semibold">Compartilhar treino</h3>
        </div>
        <p className="mt-1 text-sm text-slate-400">{treino.nome_treino}</p>

        {publico ? (
          <>
            <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4">
              <QRCodeCanvas
                id="qr-treino"
                value={url}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Qualquer pessoa que escanear vê os exercícios e a animação de
              execução — sem precisar de login.
            </p>

            <div className="mt-4 flex gap-2">
              <button onClick={copiar} className="btn-ghost flex-1">
                {copiado ? (
                  <Check className="h-4 w-4 text-volt-300" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiado ? "Copiado!" : "Copiar link"}
              </button>
              <button onClick={baixarQR} className="btn-ghost flex-1">
                <Download className="h-4 w-4" /> Baixar QR
              </button>
            </div>
            <button
              onClick={alternarPublico}
              disabled={pending}
              className="mt-3 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              Desativar compartilhamento
            </button>
          </>
        ) : (
          <>
            <p className="mt-5 text-sm text-slate-400">
              Este treino ainda está privado. Ative o compartilhamento para
              gerar o QR Code e o link públicos.
            </p>
            <button
              onClick={alternarPublico}
              disabled={pending}
              className="btn-volt mt-4 w-full"
            >
              <Share2 className="h-4 w-4" /> Ativar compartilhamento
            </button>
          </>
        )}
      </div>
    </div>
  );
}
