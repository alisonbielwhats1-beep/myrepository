"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Upload de imagem com preview. Aceita colar uma URL OU selecionar/tirar uma
 * foto. A foto é redimensionada e comprimida no próprio navegador antes de
 * virar um data URL — isso evita que fotos grandes de celular (4–8 MB)
 * estourem o limite de corpo das Server Actions do Next e "não subam".
 * A imagem é exibida no estado nativo (sem filtros).
 */
export default function ImageUpload({
  value,
  onChange,
  aspect,
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setErro(null);
    setProcessando(true);
    try {
      const dataUrl = await redimensionarImagem(file, 1024, 0.82);
      onChange(dataUrl);
    } catch {
      setErro("Não foi possível processar a imagem. Tente outra foto.");
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = ""; // permite reenviar o mesmo arquivo
    }
  };

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed border-ink-500 bg-ink-900/50",
          aspect
        )}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Pré-visualização"
              className="media-native h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-ink-950/70 text-slate-200 hover:bg-ink-950"
              aria-label="Remover imagem"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processando}
            className="grid h-full w-full place-items-center text-slate-500 transition hover:text-volt-300 disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-1">
              {processando ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ImagePlus className="h-6 w-6" />
              )}
              <span className="text-[11px]">
                {processando ? "Processando…" : hint ?? "Enviar imagem"}
              </span>
            </span>
          </button>
        )}
      </div>

      {erro && <p className="mt-1 text-[11px] text-red-400">{erro}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        value={value.startsWith("data:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole uma URL de imagem"
        className="inp mt-2 text-xs"
      />
    </div>
  );
}

/**
 * Lê o arquivo, desenha num canvas reduzido (lado máximo `maxLado`) e exporta
 * como JPEG comprimido (qualidade `qualidade`). Retorna um data URL pequeno,
 * seguro para trafegar numa Server Action.
 */
function redimensionarImagem(
  file: File,
  maxLado: number,
  qualidade: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode"));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, 0, 0, largura, altura);

        // JPEG mantém as fotos pequenas; PNG viraria enorme. Fundo branco para
        // fotos com transparência não ficarem pretas.
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
