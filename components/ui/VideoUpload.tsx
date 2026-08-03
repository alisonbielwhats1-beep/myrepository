"use client";

import { useRef, useState } from "react";
import { Loader2, Video, X } from "lucide-react";
import { enviarClipeExercicio } from "@/app/painel/[slug]/treinos/actions";
import { cn } from "@/lib/utils";

const TAMANHO_MAXIMO_BYTES = 4 * 1024 * 1024;
const TIPOS_ACEITOS = ["video/mp4", "video/webm", "image/gif"];

function ehGif(url: string) {
  return /\.gif($|\?)/i.test(url);
}

/**
 * Upload do clipe de demonstração do exercício: vídeo curto (mp4/webm) ou
 * GIF, de preferência com pessoas reais fazendo o movimento. Ao contrário de
 * ImageUpload (que comprime no navegador e guarda um data URL), o arquivo
 * aqui é grande demais para isso — sobe de verdade para o Storage via
 * enviarClipeExercicio (Server Action em app/painel/[slug]/treinos/actions.ts)
 * e o campo guarda só a URL pública que volta de lá.
 */
export default function VideoUpload({
  slug,
  value,
  onChange,
  hint,
}: {
  slug: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setErro(null);

    if (!TIPOS_ACEITOS.includes(file.type)) {
      setErro("Envie um vídeo MP4/WebM ou um GIF.");
      return;
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      setErro("Arquivo muito grande — envie um clipe curto (poucos segundos) de até 4 MB.");
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set("arquivo", file);
      const resultado = await enviarClipeExercicio(slug, formData);
      if ("erro" in resultado) {
        setErro(resultado.erro);
      } else {
        onChange(resultado.url);
      }
    } catch {
      setErro("Não foi possível enviar o arquivo. Tente novamente.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed border-ink-500 bg-ink-900/50",
          "aspect-[4/3]"
        )}
      >
        {value ? (
          <>
            {ehGif(value) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt="Pré-visualização"
                className="media-native h-full w-full object-cover"
              />
            ) : (
              <video
                src={value}
                autoPlay
                muted
                loop
                playsInline
                className="media-native h-full w-full object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-ink-950/70 text-slate-200 hover:bg-ink-950"
              aria-label="Remover clipe"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="grid h-full w-full place-items-center text-slate-500 transition hover:text-volt-300 disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-1 px-2 text-center">
              {enviando ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Video className="h-6 w-6" />
              )}
              <span className="text-[11px]">
                {enviando ? "Enviando…" : hint ?? "Vídeo ou GIF do movimento"}
              </span>
            </span>
          </button>
        )}
      </div>

      {erro && <p className="mt-1 text-[11px] text-red-400">{erro}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,image/gif"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole a URL de um clipe (mp4/webm/gif)"
        className="inp mt-2 text-xs"
      />
    </div>
  );
}
