"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  Check,
  Copy,
  Download,
  MessageCircle,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";
import { linkWhats, mensagemAcesso } from "@/lib/whats";
import { origemPublica } from "@/lib/site-url";
import { regenerarTokenAluno } from "@/app/painel/[slug]/alunos/actions";

/**
 * Acesso rápido do aluno: WhatsApp, copiar link e QR Code, todos a partir do
 * `token_acesso_publico` — nunca do `aluno.id`. O QR funciona como
 * credencial pessoal (é o mesmo link do app do aluno sem login). Regenerar o
 * token é exclusivo do dono: revoga o link/QR antigo na hora.
 */
export default function AcessoAlunoCard({
  slug,
  alunoId,
  nome,
  telefone,
  academiaNome,
  tokenAcessoPublico,
  isDono,
  isDemo,
}: {
  slug: string;
  alunoId: string;
  nome: string;
  telefone: string | null;
  academiaNome: string;
  tokenAcessoPublico: string;
  isDono: boolean;
  isDemo: boolean;
}) {
  const [token, setToken] = useState(tokenAcessoPublico);
  const [copiado, setCopiado] = useState(false);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [confirmarRegerar, setConfirmarRegerar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const url = `${origemPublica()}/aluno/${slug}/${token}`;
  const whatsHref = linkWhats(
    telefone,
    mensagemAcesso({ nome, academia: academiaNome, url }),
    { isDemo }
  );

  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  };

  const regenerar = () => {
    setErro(null);
    start(async () => {
      const r = await regenerarTokenAluno(slug, alunoId);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      if (r.token) setToken(r.token);
      setConfirmarRegerar(false);
    });
  };

  return (
    <div className="surface rounded-2xl p-5">
      <h3 className="flex items-center gap-2 font-semibold text-white">
        <QrCode className="h-4 w-4 text-volt-300" /> Acesso do aluno
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Link pessoal do app do aluno — funciona como credencial, sem senha e
        sem precisar informar o aluno pelo cadastro.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {whatsHref && (
          <a
            href={whatsHref}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            title="Enviar o link pelo WhatsApp"
          >
            <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
          </a>
        )}
        <button type="button" onClick={copiar} className="btn-ghost">
          {copiado ? (
            <Check className="h-4 w-4 text-volt-300" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <button type="button" onClick={() => setMostrarQR(true)} className="btn-ghost">
          <QrCode className="h-4 w-4" /> Mostrar QR Code
        </button>
      </div>

      {isDono && (
        <div className="mt-4 border-t border-ink-700 pt-3">
          {!confirmarRegerar ? (
            <button
              type="button"
              onClick={() => setConfirmarRegerar(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Gerar novo link (revoga o atual)
            </button>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <p>
                O link e o QR atuais deixam de funcionar imediatamente. Quem
                tiver o link antigo salvo perde o acesso. Continuar?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={regenerar}
                  className="btn-volt !py-1 text-xs disabled:opacity-50"
                >
                  {pending ? "Gerando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmarRegerar(false)}
                  className="btn-ghost !py-1 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
        </div>
      )}

      {mostrarQR &&
        createPortal(
          <DialogQR url={url} nome={nome} onClose={() => setMostrarQR(false)} />,
          document.body
        )}
    </div>
  );
}

function DialogQR({
  url,
  nome,
  onClose,
}: {
  url: string;
  nome: string;
  onClose: () => void;
}) {
  const baixar = () => {
    const canvas = document.getElementById(
      "qr-acesso-aluno"
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `acesso-${nome.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
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
          <h3 className="font-semibold">QR de acesso</h3>
        </div>
        <p className="mt-1 text-sm text-slate-400">{nome}</p>

        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-4">
          <QRCodeCanvas id="qr-acesso-aluno" value={url} size={200} level="M" includeMargin={false} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Funciona como credencial pessoal do aluno. Quem escanear abre o app
          do aluno direto — sem senha.
        </p>

        <button onClick={baixar} className="btn-ghost mt-4 w-full">
          <Download className="h-4 w-4" /> Baixar QR
        </button>
      </div>
    </div>
  );
}
