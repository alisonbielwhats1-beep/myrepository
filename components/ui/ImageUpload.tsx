"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Upload de imagem com preview. Aceita colar uma URL OU selecionar um arquivo
 * local (convertido para data URL — em produção, envie para o Supabase Storage
 * e cole a URL pública). A imagem é exibida no estado nativo (sem filtros).
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

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
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
            className="grid h-full w-full place-items-center text-slate-500 transition hover:text-volt-300"
          >
            <span className="flex flex-col items-center gap-1">
              <ImagePlus className="h-6 w-6" />
              <span className="text-[11px]">{hint ?? "Enviar imagem"}</span>
            </span>
          </button>
        )}
      </div>

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
