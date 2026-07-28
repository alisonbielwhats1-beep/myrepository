"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  AlertTriangle,
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
import { cn } from "@/lib/utils";
import {
  regenerarTokenAluno,
  regenerarTokenQrAluno,
} from "@/app/painel/[slug]/alunos/actions";

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
  recemCadastrado = false,
}: {
  slug: string;
  alunoId: string;
  nome: string;
  telefone: string | null;
  academiaNome: string;
  tokenAcessoPublico: string;
  isDono: boolean;
  isDemo: boolean;
  /** true logo após o cadastro deste aluno — destaca o envio do acesso. */
  recemCadastrado?: boolean;
}) {
  // O token NUNCA é copiado para estado a partir do prop: era isso que fazia o
  // QR continuar mostrando o aluno anterior quando o React reaproveitava esta
  // instância. Só o token *regenerado* vive em estado — e amarrado ao aluno que
  // o gerou, para que não possa vazar para outro aluno em nenhuma hipótese.
  const [regenerado, setRegenerado] = useState<{
    alunoId: string;
    token: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [confirmarRegerar, setConfirmarRegerar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // QR de acesso à recepção (Bloco 1) — credencial separada do link acima,
  // regenerada/invalidada de forma independente.
  const [confirmarRegerarQr, setConfirmarRegerarQr] = useState(false);
  const [erroQr, setErroQr] = useState<string | null>(null);
  const [okQr, setOkQr] = useState(false);
  const [pendingQr, startQr] = useTransition();

  const token =
    regenerado?.alunoId === alunoId ? regenerado.token : tokenAcessoPublico;

  // Sem token não existe link possível. Exibir o QR de outro aluno (ou uma URL
  // truncada) seria pior do que não exibir nada: o erro é explícito.
  const tokenValido = typeof token === "string" && token.trim().length > 0;
  const url = tokenValido ? `${origemPublica()}/aluno/${slug}/${token}` : "";
  const whatsHref = tokenValido
    ? linkWhats(
        telefone,
        mensagemAcesso({ nome, academia: academiaNome, url }),
        { isDemo }
      )
    : null;

  // Distingue "sem telefone utilizável" de "bloqueado por ser demonstração":
  // no primeiro caso a recepção precisa saber que basta cadastrar o WhatsApp
  // do aluno; no segundo, não há nada a corrigir. `linkWhats` já aplica a
  // mesma regra de dígitos (mínimo 10) — aqui só reproduzimos a checagem para
  // escolher a mensagem, nunca para montar o link.
  const telefoneUtilizavel = (telefone ?? "").replace(/\D/g, "").length >= 10;

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
      if (r.token) setRegenerado({ alunoId, token: r.token });
      setConfirmarRegerar(false);
    });
  };

  const regenerarQr = () => {
    setErroQr(null);
    startQr(async () => {
      const r = await regenerarTokenQrAluno(slug, alunoId);
      if (r.erro) {
        setErroQr(r.erro);
        return;
      }
      setOkQr(true);
      setConfirmarRegerarQr(false);
      setTimeout(() => setOkQr(false), 2500);
    });
  };

  return (
    <div
      className={cn(
        "surface rounded-2xl p-5",
        recemCadastrado && "border-volt-500/40 ring-1 ring-volt-500/20"
      )}
    >
      {recemCadastrado && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-200">
          <Check className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Aluno cadastrado. Envie o acesso para ele começar a usar o app.
        </p>
      )}

      <h3 className="flex items-center gap-2 font-semibold text-white">
        <QrCode className="h-4 w-4 text-volt-300" /> Acesso do aluno
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Link pessoal do app do aluno — funciona como credencial, sem senha e
        sem precisar informar o aluno pelo cadastro.
      </p>

      {!tokenValido ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Este aluno ainda não tem link de acesso. Atualize a página; se
          continuar assim, gere um novo link. Nenhum QR é exibido aqui para não
          entregar o acesso de outro aluno por engano.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsHref ? (
            <a
              href={whatsHref}
              target="_blank"
              rel="noopener noreferrer"
              // Recém-cadastrado: enviar o acesso é a próxima ação óbvia, então
              // o botão vira primário. Depois volta a ser uma opção entre as
              // outras (copiar link, mostrar QR).
              className={recemCadastrado ? "btn-volt" : "btn-ghost"}
              title="Enviar o link pessoal de acesso pelo WhatsApp"
            >
              <MessageCircle className="h-4 w-4" /> Enviar acesso pelo WhatsApp
            </a>
          ) : (
            !isDemo && (
              <button
                type="button"
                disabled
                title={
                  telefoneUtilizavel
                    ? "WhatsApp indisponível"
                    : "Cadastre o WhatsApp do aluno para enviar o acesso"
                }
                className="btn-ghost cursor-not-allowed opacity-50"
              >
                <MessageCircle className="h-4 w-4" /> Enviar acesso pelo WhatsApp
              </button>
            )
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
      )}

      {tokenValido && !whatsHref && !isDemo && !telefoneUtilizavel && (
        <p className="mt-2 text-xs text-amber-300">
          Cadastre o WhatsApp do aluno para enviar o acesso por mensagem.
          Enquanto isso, use &ldquo;Copiar link&rdquo;.
        </p>
      )}

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

          {!confirmarRegerarQr ? (
            <button
              type="button"
              onClick={() => setConfirmarRegerarQr(true)}
              className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Gerar novo QR de acesso à recepção
              (revoga o atual)
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <p>
                O QR de acesso atual do aluno para de funcionar imediatamente.
                Continuar?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pendingQr}
                  onClick={regenerarQr}
                  className="btn-volt !py-1 text-xs disabled:opacity-50"
                >
                  {pendingQr ? "Gerando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={pendingQr}
                  onClick={() => setConfirmarRegerarQr(false)}
                  className="btn-ghost !py-1 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {erroQr && <p className="mt-2 text-xs text-red-400">{erroQr}</p>}
          {okQr && (
            <p className="mt-2 text-xs text-volt-300">
              Novo QR gerado — o anterior não funciona mais.
            </p>
          )}
        </div>
      )}

      {mostrarQR &&
        tokenValido &&
        createPortal(
          // `key={url}` garante um diálogo (e um canvas) novos sempre que a URL
          // muda — nada de canvas reaproveitado com o QR do aluno anterior.
          <DialogQR
            key={url}
            url={url}
            nome={nome}
            canvasId={`qr-acesso-aluno-${alunoId}`}
            onClose={() => setMostrarQR(false)}
          />,
          document.body
        )}
    </div>
  );
}

function DialogQR({
  url,
  nome,
  canvasId,
  onClose,
}: {
  url: string;
  nome: string;
  canvasId: string;
  onClose: () => void;
}) {
  const baixar = () => {
    // Id único por aluno: com o id fixo antigo, um canvas de outro aluno ainda
    // montado podia ser encontrado primeiro e baixado no lugar deste.
    const canvas = document.getElementById(
      canvasId
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `acesso-${nome.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  return (
    // `overflow-y-auto` no fundo + `max-h` no painel: num celular baixo
    // (ex.: 320x568) o conteúdo do QR ficava mais alto que a tela e as pontas
    // eram cortadas sem possibilidade de rolar até elas.
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl p-6 text-center">
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
          <QRCodeCanvas id={canvasId} value={url} size={200} level="M" includeMargin={false} />
        </div>

        {/* A URL exata codificada neste QR, visível como texto: permite conferir
            de quem é o link sem precisar escanear — e comparar com a página que
            abriu depois de escanear. */}
        <div className="mt-4 rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-left">
          <p className="label-muted">Link deste QR</p>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate-300">
            {url}
          </p>
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
