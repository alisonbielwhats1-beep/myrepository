"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, SwitchCamera, X } from "lucide-react";

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
 */
export default function CapturaWebcam({
  onCapturar,
  onFechar,
  titulo = "Tirar foto",
}: {
  onCapturar: (file: File) => void;
  onFechar: () => void;
  titulo?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Qual câmera usar: 'user' (frontal/selfie) ou 'environment' (traseira). No
  // celular a recepção costuma querer a traseira para fotografar o aluno.
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  // Só oferece "Virar câmera" se o aparelho realmente tiver mais de uma —
  // num desktop com uma webcam só, virar não faria nada.
  const [multiCam, setMultiCam] = useState(false);

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

  // Fecha no Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

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
    // preview, via CSS.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErro("Não foi possível capturar a imagem. Tente novamente.");
          return;
        }
        onCapturar(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
        onFechar();
      },
      "image/jpeg",
      0.92
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="surface-strong w-full max-w-md overflow-hidden rounded-2xl border">
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Camera className="h-4 w-4 text-volt-300" /> {titulo}
          </h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-ink-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-square w-full bg-ink-900">
          {/* Espelha o preview só na câmera frontal (efeito selfie); na traseira
              mostra a imagem real. A foto salva nunca é espelhada. */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={
              "h-full w-full object-cover" +
              (facingMode === "user" ? " [transform:scaleX(-1)]" : "")
            }
          />
          {!pronto && !erro && (
            <div className="absolute inset-0 grid place-items-center text-slate-400">
              <span className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Abrindo a câmera…
              </span>
            </div>
          )}
          {erro && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="text-sm text-red-300">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ink-700 px-4 py-3">
          {multiCam ? (
            <button
              type="button"
              onClick={() =>
                setFacingMode((m) => (m === "user" ? "environment" : "user"))
              }
              className="btn-ghost !py-2 text-sm"
              title="Alternar entre a câmera frontal e a traseira"
            >
              <SwitchCamera className="h-4 w-4" /> Virar câmera
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onFechar} className="btn-ghost !py-2 text-sm">
              Cancelar
            </button>
            <button
              type="button"
              onClick={capturar}
              disabled={!pronto || !!erro}
              className="btn-volt !py-2 text-sm disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Capturar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
