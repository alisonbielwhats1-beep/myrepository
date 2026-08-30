"use client";

import { useRef, useState, useTransition } from "react";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import AvatarAluno from "./AvatarAluno";
import { prepararFotoParaEnvio } from "@/lib/imagem-cliente";

type EstadoFoto = { erro?: string; ok?: boolean; savedAt?: number };

export default function FotoPerfilForm({
  nome,
  fotoAtual,
  atualizar,
}: {
  nome: string;
  fotoAtual: string | null;
  atualizar: (estado: EstadoFoto, formData: FormData) => Promise<EstadoFoto>;
}) {
  const [aberto, setAberto] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const galeriaRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-ghost flex-none text-sm"
      >
        <ImagePlus className="h-4 w-4" /> Trocar foto
      </button>
    );
  }

  const escolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    setErro(null);
    setOk(false);
    const resultado = await prepararFotoParaEnvio(file);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setBlob(resultado.blob);
    setPreview(resultado.previewUrl);
  };

  const cancelarSelecao = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setBlob(null);
    setErro(null);
  };

  const salvar = () => {
    if (!blob) return;
    setErro(null);
    start(async () => {
      const fd = new FormData();
      fd.append("foto", blob, "foto.jpg");
      const resultado = await atualizar({}, fd);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      cancelarSelecao();
      setOk(true);
    });
  };

  const remover = () => {
    setErro(null);
    start(async () => {
      const fd = new FormData();
      fd.append("remover", "1");
      const resultado = await atualizar({}, fd);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      cancelarSelecao();
      setOk(true);
    });
  };

  return (
    // Sem `surface` própria de propósito: este formulário sempre aparece
    // aninhado dentro de outro card (header do Perfil), então ganhar sua
    // própria borda/fundo criaria uma caixa dentro de caixa.
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AvatarAluno nome={nome} fotoUrl={preview ?? fotoAtual} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Foto de perfil</p>
          <p className="text-xs text-slate-500">JPG, PNG ou WebP, até 5 MB.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            cancelarSelecao();
            setAberto(false);
          }}
          className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-500 hover:text-slate-300"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {erro}
        </p>
      )}
      {ok && !blob && (
        <p className="flex items-center gap-1.5 rounded-lg border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-xs text-volt-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Foto atualizada.
        </p>
      )}

      <input
        ref={galeriaRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => escolherArquivo(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        onChange={(e) => escolherArquivo(e.target.files?.[0])}
      />

      {blob ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancelarSelecao}
            disabled={pending}
            className="btn-ghost flex-1"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={pending}
            className="btn-volt flex-1"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            Salvar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="btn-ghost flex-1"
          >
            <Camera className="h-4 w-4" /> Tirar foto
          </button>
          <button
            type="button"
            onClick={() => galeriaRef.current?.click()}
            className="btn-ghost flex-1"
          >
            <ImagePlus className="h-4 w-4" /> Escolher da galeria
          </button>
          {fotoAtual && (
            <button
              type="button"
              onClick={remover}
              disabled={pending}
              className="btn-ghost w-full text-red-300 hover:bg-red-500/10"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remover foto
            </button>
          )}
        </div>
      )}
    </div>
  );
}
