"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
} from "lucide-react";
import type { ComentarioComunidade, PostComunidade } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import BotaoCompartilhar from "./BotaoCompartilhar";
import type { AcoesComunidade } from "./FeedComunidade";

/**
 * Um post do feed: autor (só nome + avatar), imagem/legenda, curtir, comentar,
 * compartilhar, e — conforme quem vê — excluir o próprio conteúdo ou denunciar.
 * Todas as ações têm resposta otimista; o servidor confirma em seguida.
 */
export default function PostCard({
  post,
  academiaNome,
  eu,
  acoes,
  onRemovido,
}: {
  post: PostComunidade;
  academiaNome: string;
  eu: { nome: string; foto_url: string | null };
  acoes: AcoesComunidade;
  onRemovido: (postId: string) => void;
}) {
  const [curtido, setCurtido] = useState(post.curtido_por_mim);
  const [totalCurtidas, setTotalCurtidas] = useState(post.total_curtidas);
  const [comentarios, setComentarios] = useState<ComentarioComunidade[]>(post.comentarios);
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [texto, setTexto] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoComentario, startComentario] = useTransition();
  const curtindoRef = useRef(false);

  function toggleCurtida() {
    if (curtindoRef.current) return;
    curtindoRef.current = true;
    const proximo = !curtido;
    // Otimista
    setCurtido(proximo);
    setTotalCurtidas((n) => n + (proximo ? 1 : -1));
    acoes
      .curtir(post.id, proximo)
      .then((r) => {
        if (r.erro) {
          // Reverte
          setCurtido(!proximo);
          setTotalCurtidas((n) => n + (proximo ? -1 : 1));
        } else if (typeof r.total === "number") {
          setTotalCurtidas(r.total);
          if (typeof r.curtido === "boolean") setCurtido(r.curtido);
        }
      })
      .finally(() => {
        curtindoRef.current = false;
      });
  }

  function enviarComentario() {
    const limpo = texto.trim();
    if (!limpo) return;
    setErro(null);
    startComentario(async () => {
      const r = await acoes.comentar(post.id, limpo);
      if (r.erro || !r.comentario) {
        setErro(r.erro ?? "Não foi possível comentar.");
        return;
      }
      setComentarios((c) => [...c, r.comentario as ComentarioComunidade]);
      setTexto("");
      setMostrarComentarios(true);
    });
  }

  function excluirPost() {
    setMenuAberto(false);
    onRemovido(post.id); // some da lista na hora
    acoes.excluirPost(post.id).then((r) => {
      if (r.erro) setErro(r.erro);
    });
  }

  function excluirComentario(id: string) {
    setComentarios((c) => c.filter((x) => x.id !== id)); // otimista
    acoes.excluirComentario(id);
  }

  function denunciar() {
    setMenuAberto(false);
    acoes.denunciar(post.id, "").then((r) => {
      if (!r.erro) setErro("Denúncia enviada. A academia vai avaliar. Obrigado.");
    });
  }

  return (
    <article className="surface overflow-hidden rounded-2xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <AvatarAluno nome={post.autor.nome} fotoUrl={post.autor.foto_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{post.autor.nome}</p>
          <p className="text-xs text-slate-500">{timeAgo(post.criado_em)}</p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:text-slate-200"
            aria-label="Mais opções"
            aria-expanded={menuAberto}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuAberto && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-hidden
                onClick={() => setMenuAberto(false)}
                tabIndex={-1}
              />
              <div
                role="menu"
                className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-card"
              >
                {post.sou_autor ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={excluirPost}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 hover:bg-ink-700"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir publicação
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={denunciar}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-ink-700"
                  >
                    <Flag className="h-4 w-4" /> Denunciar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legenda */}
      {post.legenda && (
        <p className="whitespace-pre-line px-4 pb-3 text-sm text-slate-200">
          {post.legenda}
        </p>
      )}

      {/* Imagem */}
      {post.imagem_url && (
        <div className="relative w-full bg-ink-900">
          <Image
            src={post.imagem_url}
            alt={post.legenda ?? `Publicação de ${post.autor.nome}`}
            width={1080}
            height={1080}
            sizes="(max-width: 480px) 100vw, 480px"
            className="media-native h-auto max-h-[70vh] w-full object-contain"
          />
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          type="button"
          onClick={toggleCurtida}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium transition",
            curtido ? "text-magenta-400" : "text-slate-400 hover:text-slate-200"
          )}
          aria-pressed={curtido}
        >
          <Heart className={cn("h-5 w-5", curtido && "fill-current")} />
          {totalCurtidas > 0 && <span className="tabular-nums">{totalCurtidas}</span>}
        </button>

        <button
          type="button"
          onClick={() => setMostrarComentarios((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-slate-200"
        >
          <MessageCircle className="h-5 w-5" />
          {post.total_comentarios + (comentarios.length - post.comentarios.length) > 0 && (
            <span className="tabular-nums">
              {post.total_comentarios + (comentarios.length - post.comentarios.length)}
            </span>
          )}
        </button>

        <div className="ml-auto">
          <BotaoCompartilhar
            legenda={post.legenda}
            imagemUrl={post.imagem_url}
            academiaNome={academiaNome}
          />
        </div>
      </div>

      {erro && (
        <p className="mx-4 mb-3 rounded-lg border border-ink-600 bg-ink-900/60 px-3 py-2 text-xs text-slate-300">
          {erro}
        </p>
      )}

      {/* Comentários */}
      {mostrarComentarios && (
        <div className="space-y-3 border-t border-ink-600/60 px-4 py-3">
          {comentarios.length === 0 ? (
            <p className="text-xs text-slate-500">Seja o primeiro a comentar.</p>
          ) : (
            comentarios.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <AvatarAluno nome={c.autor.nome} fotoUrl={c.autor.foto_url} size={28} />
                <div className="min-w-0 flex-1 rounded-2xl bg-ink-900/60 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-white">
                      {c.autor.nome}
                    </p>
                    <span className="flex-none text-[10px] text-slate-500">
                      {timeAgo(c.criado_em)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-200">
                    {c.texto}
                  </p>
                </div>
                {c.sou_autor && (
                  <button
                    type="button"
                    onClick={() => excluirComentario(c.id)}
                    className="mt-1 text-slate-600 hover:text-red-300"
                    aria-label="Excluir comentário"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}

          {/* Novo comentário */}
          <div className="flex items-center gap-2 pt-1">
            <AvatarAluno nome={eu.nome} fotoUrl={eu.foto_url} size={28} />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviarComentario();
                }
              }}
              maxLength={300}
              placeholder="Escreva um comentário..."
              className="inp py-2"
            />
            <button
              type="button"
              onClick={enviarComentario}
              disabled={!texto.trim() || enviandoComentario}
              className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-volt-300 text-ink-950 transition disabled:opacity-40"
              aria-label="Enviar comentário"
            >
              {enviandoComentario ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
