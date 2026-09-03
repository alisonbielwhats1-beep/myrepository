"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Loader2,
  RotateCcw,
  SwitchCamera,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Portal from "@/components/ui/Portal";

/**
 * Captura de foto pela webcam (getUserMedia) — abre a câmera do próprio
 * aparelho ao vivo e devolve um File JPEG do quadro escolhido. Serve o caso da
 * recepção num computador com webcam USB: o `<input capture>` só abre a câmera
 * no celular; no desktop ele cai no seletor de arquivos, então a captura ao
 * vivo precisa ser feita aqui.
 *
 * Requer contexto seguro (HTTPS) — garantido em produção (Vercel) e em
 * localhost. O stream é sempre encerrado ao fechar (nenhuma luz de câmera fica
 * acesa depois). Começa na câmera frontal; em aparelhos com mais de uma câmera
 * (celular) há o botão "Virar câmera" para alternar com a traseira. O preview é
 * espelhado só na frontal (efeito selfie); o arquivo salvo sai sempre na
 * orientação real.
 *
 * DOIS MODOS, UMA JANELA
 *   1. "camera"  — visor ao vivo + "Capturar".
 *   2. "revisao" — a foto tirada + "Confirmar foto" / "Tirar novamente" /
 *      "Cancelar".
 *   Antes a captura fechava a janela na hora e a confirmação real acabava
 *   sendo o botão de salvar do formulário, lá no rodapé de uma página longa —
 *   o usuário tinha que rolar para concluir. Agora a decisão inteira acontece
 *   aqui, com as três ações sempre visíveis.
 *
 * LAYOUT QUE NÃO ESCONDE O RODAPÉ
 *   O painel é uma coluna com altura máxima (`max-h`): cabeçalho e rodapé são
 *   `flex-none` e só a área do meio rola. O lado do quadro da foto é
 *   `min(largura disponível, 48dvh)`, então a janela inteira cabe também em
 *   tela baixa (celular deitado, notebook 1366×768) sem nunca empurrar
 *   "Confirmar foto" para fora da vista. O rodapé respeita a safe area do
 *   iPhone.
 */
export default function CapturaWebcam({
  onCapturar,
  onFechar,
  titulo = "Tirar foto",
}: {
  /**
   * Recebe a foto confirmada. Devolver uma mensagem de erro (string) mantém a
   * janela aberta e exibe o erro ali mesmo — o usuário tenta de novo sem
   * perder o contexto. Devolver null/undefined fecha a janela.
   */
  onCapturar: (file: File) => void | Promise<string | null | void>;
  onFechar: () => void;
  titulo?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const acaoPrincipalRef = useRef<HTMLButtonElement>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Qual câmera usar: 'user' (frontal/selfie) ou 'environment' (traseira). No
  // celular a recepção costuma querer a traseira para fotografar o aluno.
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  // Só oferece "Virar câmera" se o aparelho realmente tiver mais de uma —
  // num desktop com uma webcam só, virar não faria nada.
  const [multiCam, setMultiCam] = useState(false);

  const [modo, setModo] = useState<"camera" | "revisao">("camera");
  const [foto, setFoto] = useState<{ file: File; url: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  // Reabre o stream sempre que a câmera escolhida muda (facingMode).
  useEffect(() => {
    let cancelado = false;

    async function abrir() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro("Este navegador não permite usar a câmera. Use o Chrome ou o Edge.");
        return;
      }
      setPronto(false);
      setErro(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `ideal` (não `exact`): num aparelho com uma câmera só, usa a que
          // houver em vez de falhar quando a traseira não existe.
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPronto(true);
        // enumerateDevices só lista/rotula tudo DEPOIS da permissão concedida —
        // por isso conta as câmeras aqui, com o stream já aberto.
        try {
          const dispositivos = await navigator.mediaDevices.enumerateDevices();
          if (!cancelado) {
            const cameras = dispositivos.filter((d) => d.kind === "videoinput");
            setMultiCam(cameras.length > 1);
          }
        } catch {
          // Best-effort: sem a contagem, só não mostra o botão de virar.
        }
      } catch (e) {
        const nome = (e as DOMException)?.name;
        if (nome === "NotAllowedError" || nome === "SecurityError") {
          setErro("Permissão da câmera negada. Autorize a câmera no navegador e tente de novo.");
        } else if (nome === "NotFoundError" || nome === "DevicesNotFoundError") {
          setErro("Nenhuma câmera encontrada. Verifique se a webcam está conectada.");
        } else if (nome === "NotReadableError") {
          setErro("A câmera está em uso por outro programa. Feche-o e tente de novo.");
        } else {
          setErro("Não foi possível abrir a câmera. Tente novamente.");
        }
      }
    }

    abrir();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  // A prévia é um objectURL — some junto com a foto descartada e no fechamento.
  useEffect(() => {
    return () => {
      if (foto) URL.revokeObjectURL(foto.url);
    };
  }, [foto]);

  const fechar = useCallback(() => {
    if (confirmando) return; // nunca fecha no meio de um envio
    onFechar();
  }, [confirmando, onFechar]);

  // Esc fecha; Tab circula só dentro da janela (não vaza para a página atrás).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar();
        return;
      }
      if (e.key !== "Tab") return;
      const painel = painelRef.current;
      if (!painel) return;
      const focaveis = Array.from(
        painel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (e.shiftKey && (ativo === primeiro || !painel.contains(ativo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fechar]);

  // A ação principal de cada modo recebe o foco — quem usa teclado ou leitor de
  // tela cai direto no "Capturar"/"Confirmar foto".
  useEffect(() => {
    acaoPrincipalRef.current?.focus();
  }, [modo]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setErro("Não foi possível capturar a imagem neste navegador.");
      return;
    }
    // Desenha o quadro na orientação real (sem espelhar) — o espelho é só do
    // preview ao vivo, via CSS. Por isso a foto da revisão aparece "ao
    // contrário" do visor na câmera frontal: é exatamente o que será salvo.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErro("Não foi possível capturar a imagem. Tente novamente.");
          return;
        }
        const file = new File([blob], "webcam.jpg", { type: "image/jpeg" });
        setFoto({ file, url: URL.createObjectURL(blob) });
        setErroConfirmacao(null);
        setModo("revisao");
      },
      "image/jpeg",
      0.92
    );
  };

  const tirarNovamente = () => {
    if (confirmando) return;
    setFoto(null);
    setErroConfirmacao(null);
    setModo("camera");
  };

  const confirmar = async () => {
    if (!foto || confirmando) return;
    setConfirmando(true);
    setErroConfirmacao(null);
    try {
      const resultado = await Promise.resolve(onCapturar(foto.file));
      if (typeof resultado === "string" && resultado) {
        setErroConfirmacao(resultado);
        setConfirmando(false);
        return;
      }
      onFechar();
    } catch {
      setErroConfirmacao("Não foi possível usar esta foto. Tente novamente.");
      setConfirmando(false);
    }
  };

  const emRevisao = modo === "revisao";

  return (
    // Portal obrigatório: os dois componentes que abrem esta janela têm
    // `.surface` na raiz (backdrop-filter), que ancoraria o `fixed` no card e
    // deixaria a câmera cortada dentro dele. Ver components/ui/Portal.tsx.
    <Portal>
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-ink-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        ref={painelRef}
        className="surface-strong my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border"
      >
        <div className="flex flex-none items-center justify-between border-b border-ink-700 px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Camera className="h-4 w-4 text-volt-300" /> {titulo}
          </h3>
          <button
            type="button"
            onClick={fechar}
            disabled={confirmando}
            aria-label="Fechar"
            className="grid h-11 w-11 place-items-center rounded-lg text-slate-400 transition hover:bg-ink-700 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Único bloco que rola: em tela muito baixa a prévia encolhe/rola,
            enquanto cabeçalho e rodapé ficam parados. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* O lado do quadrado é limitado pela ALTURA da tela (48dvh) e pela
              largura disponível — nunca estoura o modal nem distorce a foto. */}
          <div className="relative mx-auto aspect-square w-full max-w-[min(100%,48dvh)] overflow-hidden rounded-xl bg-ink-900">
            {/* Espelha o preview só na câmera frontal (efeito selfie); na
                traseira mostra a imagem real. A foto salva nunca é espelhada. */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover",
                facingMode === "user" && "[transform:scaleX(-1)]"
              )}
            />

            {emRevisao && foto && (
              // object-cover num quadro quadrado mostra exatamente o recorte
              // central que o envio vai gravar (lib/imagem-cliente.ts) — sem
              // deformar a imagem.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={foto.url}
                alt="Prévia da foto capturada"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {!emRevisao && !pronto && !erro && (
              <div className="absolute inset-0 grid place-items-center text-slate-400">
                <span className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a câmera…
                </span>
              </div>
            )}
            {!emRevisao && erro && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <p className="text-sm text-red-300">{erro}</p>
              </div>
            )}

            {confirmando && (
              <div className="absolute inset-0 grid place-items-center bg-ink-950/60">
                <span className="flex items-center gap-2 text-sm text-white">
                  <Loader2 className="h-4 w-4 animate-spin" /> Confirmando…
                </span>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            {emRevisao
              ? "Confira o enquadramento. A foto é recortada no quadrado."
              : "Enquadre o rosto no quadro e toque em Capturar."}
          </p>

          {erroConfirmacao && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {erroConfirmacao}
            </p>
          )}
        </div>

        {/* Rodapé fixo — as três ações nunca saem da vista, e ficam acima da
            safe area (barra inferior do iPhone). */}
        <div className="flex flex-none flex-wrap items-center gap-2 border-t border-ink-700 px-4 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          {emRevisao ? (
            <>
              <button
                type="button"
                onClick={tirarNovamente}
                disabled={confirmando}
                className="btn-ghost min-h-11 text-sm disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> Tirar novamente
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={confirmando}
                  className="btn-ghost min-h-11 text-sm disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  ref={acaoPrincipalRef}
                  type="button"
                  onClick={confirmar}
                  disabled={confirmando}
                  className="btn-volt min-h-11 text-sm disabled:opacity-50"
                >
                  {confirmando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {confirmando ? "Confirmando…" : "Confirmar foto"}
                </button>
              </div>
            </>
          ) : (
            <>
              {multiCam && (
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === "user" ? "environment" : "user"))
                  }
                  className="btn-ghost min-h-11 text-sm"
                  title="Alternar entre a câmera frontal e a traseira"
                >
                  <SwitchCamera className="h-4 w-4" /> Virar câmera
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={fechar}
                  className="btn-ghost min-h-11 text-sm"
                >
                  Cancelar
                </button>
                <button
                  ref={acaoPrincipalRef}
                  type="button"
                  onClick={capturar}
                  disabled={!pronto || !!erro}
                  className="btn-volt min-h-11 text-sm disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" /> Capturar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
