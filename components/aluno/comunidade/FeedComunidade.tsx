"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import type { PostComunidade } from "@/lib/types";
import type {
  EstadoComentario,
  EstadoCurtida,
  EstadoPost,
  EstadoSimples,
} from "@/app/aluno/[slug]/[token]/comunidade/actions";
import NovaPublicacao from "./NovaPublicacao";
import PostCard from "./PostCard";

/** Ações do feed já vinculadas a (slug, token) na página do servidor. */
export type AcoesComunidade = {
  curtir: (postId: string, curtir: boolean) => Promise<EstadoCurtida>;
  comentar: (postId: string, texto: string) => Promise<EstadoComentario>;
  excluirPost: (postId: string) => Promise<EstadoSimples>;
  excluirComentario: (comentarioId: string) => Promise<EstadoSimples>;
  denunciar: (postId: string, motivo: string) => Promise<EstadoSimples>;
};

export default function FeedComunidade({
  academiaNome,
  eu,
  postsIniciais,
  criar,
  acoes,
}: {
  academiaNome: string;
  eu: { nome: string; foto_url: string | null };
  postsIniciais: PostComunidade[];
  criar: (estado: EstadoPost, formData: FormData) => Promise<EstadoPost>;
  acoes: AcoesComunidade;
}) {
  const [posts, setPosts] = useState<PostComunidade[]>(postsIniciais);

  return (
    <div className="space-y-4">
      <NovaPublicacao
        eu={eu}
        criar={criar}
        onCriado={(post) => setPosts((atual) => [post, ...atual])}
      />

      {posts.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-volt-300/15 text-volt-300">
            <Users className="h-6 w-6" />
          </span>
          <p className="font-semibold text-white">Ainda não há publicações</p>
          <p className="max-w-xs text-sm text-slate-400">
            Seja o primeiro a compartilhar algo com a galera da {academiaNome}.
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            academiaNome={academiaNome}
            eu={eu}
            acoes={acoes}
            onRemovido={(id) => setPosts((atual) => atual.filter((p) => p.id !== id))}
          />
        ))
      )}
    </div>
  );
}
