"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import type { PostComunidade } from "@/lib/types";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import { prepararImagemComunidade } from "@/lib/imagem-cliente";
import type { EstadoPost } from "@/app/aluno/[slug]/[token]/comunidade/actions";

const LEGENDA_MAX = 500;

/**
 * Composer de publicação: legenda + 1 imagem opcional. A imagem é
 * redimensionada e comprimida NO NAVEGADOR (prepararImagemComunidade) antes de
 * subir — o servidor recebe o blob já pronto e revalida. Em sucesso, entrega o
 * post criado ao feed (inserção otimista no topo).
 */
export default function NovaPublicacao({
  eu,
  criar,
  onCriado,
}: {
  eu: { nome: string; foto_url: string | null };
  criar: (estado: EstadoPost, formData: FormData) => Promise<EstadoPost>;
  onCriado: (post: PostComunidade) => void;
}) {
  const [legenda, setLegenda] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [enviando, startEnvio] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function limparImagem() {
    if (preview) URL.revokeObjectURL(preview);
    setBlob(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function escolherImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    setProcessando(true);
    const r = await prepararImagemComunidade(file);
    setProcessando(false);
    if ("erro" in r) {
      setErro(r.erro);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setBlob(r.blob);
    setPreview(r.previewUrl);
  }

  function publicar() {
    const texto = legenda.trim();
    if (!texto && !blob) {
      setErro("Escreva algo ou anexe uma imagem.");
      return;
    }
    setErro(null);
    const fd = new FormData();
    fd.set("legenda", texto);
    if (blob) fd.set("imagem", new File([blob], "publicacao.jpg", { type: blob.type }));

    startEnvio(async () => {
      const r = await criar({}, fd);
      if (r.erro || !r.post) {
        setErro(r.erro ?? "Não foi possível publicar.");
        return;
      }
      onCriado(r.post);
      setLegenda("");
      limparImagem();
    });
  }

  const ocupado = enviando || processando;

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex gap-3">
        <AvatarAluno nome={eu.nome} fotoUrl={eu.foto_url} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={legenda}
            onChange={(e) => setLegenda(e.target.value.slice(0, LEGENDA_MAX))}
            rows={2}
            placeholder="Compartilhe seu treino, uma conquista, uma dica..."
            className="inp resize-none"
          />

          {preview && (
            <div className="relative mt-3 overflow-hidden rounded-xl border border-ink-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Pré-visualização"
                className="media-native max-h-72 w-full object-cover"
              />
              <button
                type="button"
                onClick={limparImagem}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink-950/70 text-white backdrop-blur"
                aria-label="Remover imagem"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {erro && (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erro}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={ocupado}
                className="inline-flex items-center gap-2 rounded-xl border border-volt-500/40 bg-volt-500/10 px-3 py-2 text-sm font-semibold text-volt-300 transition hover:bg-volt-500/20 disabled:opacity-50"
              >
                {processando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {preview ? "Trocar foto" : "Adicionar foto"}
              </button>
              {legenda.length > LEGENDA_MAX - 80 && (
                <span className="text-[11px] text-slate-500">
                  {LEGENDA_MAX - legenda.length}
                </span>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={escolherImagem}
                className="hidden"
              />
            </div>

            <button
              type="button"
              onClick={publicar}
              disabled={ocupado || (!legenda.trim() && !blob)}
              className="btn-volt px-4 py-2 text-sm disabled:opacity-40"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
