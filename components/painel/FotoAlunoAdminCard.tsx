"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Trash2, UserRound } from "lucide-react";
import Image from "next/image";
import { prepararFotoParaEnvio } from "@/lib/imagem-cliente";
import CapturaWebcam from "@/components/ui/CapturaWebcam";
import {
  atualizarFotoAlunoAdmin,
  removerFotoAlunoAdmin,
} from "@/app/painel/[slug]/alunos/actions";

/**
 * Foto de perfil na ficha do aluno (painel). Mesma preparação (recorte
 * quadrado + compressão) e o mesmo destino (Supabase Storage) da tela do
 * aluno — só muda quem autoriza: aqui é a sessão do painel (requireSecao),
 * lá é o token pessoal.
 */
export default function FotoAlunoAdminCard({
  slug,
  alunoId,
  nome,
  fotoUrl,
}: {
  slug: string;
  alunoId: string;
  nome: string;
  fotoUrl: string | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [mostrarWebcam, setMostrarWebcam] = useState(false);
  const galeriaRef = useRef<HTMLInputElement>(null);

  /**
   * Recorta/comprime e guarda a foto. Devolve a mensagem de erro (ou null) —
   * é esse retorno que a janela da câmera usa para exibir a falha nela mesma,
   * em vez de fechar e deixar o aviso escondido atrás do modal.
   */
  const processarFoto = async (file: File): Promise<string | null> => {
    const resultado = await prepararFotoParaEnvio(file);
    if ("erro" in resultado) return resultado.erro;
    if (preview) URL.revokeObjectURL(preview);
    setBlob(resultado.blob);
    setPreview(resultado.previewUrl);
    setErro(null);
    return null;
  };

  // Caminho do "Enviar arquivo": sem modal, o erro aparece no próprio cartão.
  const escolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    setErro(null);
    const mensagem = await processarFoto(file);
    if (mensagem) setErro(mensagem);
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
      const resultado = await atualizarFotoAlunoAdmin(slug, alunoId, {}, fd);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      cancelarSelecao();
      router.refresh();
    });
  };

  const remover = () => {
    setErro(null);
    start(async () => {
      const resultado = await removerFotoAlunoAdmin(slug, alunoId);
      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  };

  const fotoExibida = preview ?? fotoUrl;

  return (
    <div className="surface rounded-2xl p-5">
      <h3 className="font-semibold text-white">Foto de perfil</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        Aparece na ficha, na recepção e no app do aluno. JPG, PNG ou WebP, até 5 MB.
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-20 w-20 flex-none overflow-hidden rounded-full ring-1 ring-ink-600">
          {fotoExibida ? (
            <Image
              src={fotoExibida}
              alt={nome}
              fill
              sizes="80px"
              className="media-native object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-ink-700 text-slate-500">
              <UserRound className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
              {erro}
            </p>
          )}

          <input
            ref={galeriaRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => escolherArquivo(e.target.files?.[0])}
          />
          {blob ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={salvar}
                disabled={pending}
                className="btn-volt min-h-11 text-xs disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Salvar
              </button>
              <button
                type="button"
                onClick={cancelarSelecao}
                disabled={pending}
                className="btn-ghost min-h-11 text-xs"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMostrarWebcam(true)}
                className="btn-ghost min-h-11 text-xs"
              >
                <Camera className="h-3.5 w-3.5" /> Tirar foto
              </button>
              <button
                type="button"
                onClick={() => galeriaRef.current?.click()}
                className="btn-ghost min-h-11 text-xs"
              >
                <ImagePlus className="h-3.5 w-3.5" /> Enviar arquivo
              </button>
              {fotoUrl && (
                <button
                  type="button"
                  onClick={remover}
                  disabled={pending}
                  className="btn-ghost min-h-11 text-xs text-red-300 hover:bg-red-500/10"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remover
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {mostrarWebcam && (
        <CapturaWebcam
          titulo={`Foto de ${nome.split(" ")[0]}`}
          onCapturar={processarFoto}
          onFechar={() => setMostrarWebcam(false)}
        />
      )}
    </div>
  );
}
