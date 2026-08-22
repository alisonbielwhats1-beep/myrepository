"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Flag, Heart, Loader2, MessageCircle, RotateCcw, Trash2 } from "lucide-react";
import type { PostModeracao } from "@/lib/types";
import { cn, formatDataDeInstante } from "@/lib/utils";
import AvatarAluno from "@/components/aluno/AvatarAluno";
import {
  removerPostModeracao,
  restaurarPostModeracao,
} from "@/app/painel/[slug]/comunidade/actions";

/** Rótulo do badge de "removido" conforme quem tirou o post do ar. */
function rotuloRemocao(por: PostModeracao["removido_por"]): string {
  if (por === "autor") return "Removido pelo autor";
  if (por === "auto") return "Ocultado automaticamente";
  return "Removido pela moderação";
}

/**
 * Moderação da comunidade (painel). Lista as publicações da academia
 * (denunciadas primeiro), com a opção de remover. Isolada por tenant no banco
 * (RPC resolve a academia pela sessão). Filtro simples: todas × denunciadas.
 */
export default function ModeracaoComunidade({
  slug,
  postsIniciais,
}: {
  slug: string;
  postsIniciais: PostModeracao[];
}) {
  const [posts, setPosts] = useState<PostModeracao[]>(postsIniciais);
  const [filtro, setFiltro] = useState<"todos" | "denunciados">("todos");
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visiveis =
    filtro === "denunciados" ? posts.filter((p) => p.total_denuncias > 0) : posts;

  function remover(postId: string) {
    setRemovendo(postId);
    startTransition(async () => {
      const r = await removerPostModeracao(slug, postId);
      setRemovendo(null);
      if (!("erro" in r)) {
        setPosts((atual) =>
          atual.map((p) =>
            p.id === postId
              ? { ...p, removido_em: new Date().toISOString(), removido_por: "moderacao" }
              : p
          )
        );
      }
    });
  }

  function restaurar(postId: string) {
    setRestaurando(postId);
    startTransition(async () => {
      const r = await restaurarPostModeracao(slug, postId);
      setRestaurando(null);
      if (!("erro" in r)) {
        setPosts((atual) =>
          atual.map((p) =>
            p.id === postId
              ? { ...p, removido_em: null, removido_por: null }
              : p
          )
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["todos", "denunciados"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition",
              filtro === f
                ? "bg-volt-300 text-ink-950"
                : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
            )}
          >
            {f === "todos" ? "Todas" : "Denunciadas"}
            {f === "denunciados" && (
              <span className="ml-1.5 tabular-nums text-xs">
                ({posts.filter((p) => p.total_denuncias > 0).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          {filtro === "denunciados"
            ? "Nenhuma publicação denunciada. 👍"
            : "Nenhuma publicação na comunidade ainda."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((post) => {
            const removido = !!post.removido_em;
            return (
              <li
                key={post.id}
                className={cn(
                  "surface flex gap-3 rounded-2xl p-4",
                  removido && "opacity-60"
                )}
              >
                {post.imagem_url ? (
                  <div className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-ink-900">
                    <Image
                      src={post.imagem_url}
                      alt=""
                      fill
                      sizes="80px"
                      className="media-native object-cover"
                    />
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <AvatarAluno
                      nome={post.autor.nome}
                      fotoUrl={post.autor.foto_url}
                      size={24}
                    />
                    <span className="truncate text-sm font-medium text-white">
                      {post.autor.nome}
                    </span>
                    <span className="flex-none text-xs text-slate-500">
                      {formatDataDeInstante(post.criado_em)}
                    </span>
                  </div>

                  {post.legenda && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                      {post.legenda}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> {post.total_curtidas}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {post.total_comentarios}
                    </span>
                    {post.total_denuncias > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-semibold text-red-300">
                        <Flag className="h-3 w-3" /> {post.total_denuncias}{" "}
                        {post.total_denuncias === 1 ? "denúncia" : "denúncias"}
                      </span>
                    )}
                    {removido && (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5",
                          post.removido_por === "auto"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            : "border-ink-500 bg-ink-700 text-slate-400"
                        )}
                      >
                        {rotuloRemocao(post.removido_por)}
                      </span>
                    )}
                  </div>
                </div>

                {!removido ? (
                  <button
                    type="button"
                    onClick={() => remover(post.id)}
                    disabled={removendo === post.id}
                    className="flex h-fit flex-none items-center gap-1.5 rounded-lg border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
                  >
                    {removendo === post.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remover
                  </button>
                ) : (
                  // Só a moderação (manual/auto) pode ser desfeita — a exclusão
                  // do próprio autor é preservada.
                  post.removido_por !== "autor" && (
                    <button
                      type="button"
                      onClick={() => restaurar(post.id)}
                      disabled={restaurando === post.id}
                      className="flex h-fit flex-none items-center gap-1.5 rounded-lg border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-volt-500/40 hover:text-volt-300 disabled:opacity-60"
                    >
                      {restaurando === post.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restaurar
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
