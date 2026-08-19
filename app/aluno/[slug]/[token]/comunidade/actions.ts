"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getFichaAlunoPublica } from "@/lib/data";
import {
  enviarImagemComunidade,
  validarImagemComunidade,
} from "@/lib/comunidade-fotos";
import type {
  ComentarioComunidade,
  PostComunidade,
} from "@/lib/types";

export type EstadoPost = { erro?: string; ok?: boolean; post?: PostComunidade; savedAt?: number };
export type EstadoCurtida = {
  erro?: string;
  postId?: string;
  curtido?: boolean;
  total?: number;
};
export type EstadoComentario = { erro?: string; comentario?: ComentarioComunidade };
export type EstadoSimples = { erro?: string; ok?: boolean };

/** IP real do cliente (mesmo helper do feedback/foto), para o rate-limit. */
function ipCliente(): string {
  const h = headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const partes = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return partes[partes.length - 1] || "desconhecido";
}

/**
 * Cria uma publicação do próprio aluno (legenda + imagem opcional). Resolve o
 * aluno INTEIRAMENTE por token+slug antes de qualquer upload. A imagem vai para
 * o bucket `comunidade` pela service role; a RPC `criar_post_comunidade` recebe
 * só a URL pronta e ainda a valida. Anti-spam por IP+token (além do limite que
 * a própria RPC aplica por aluno).
 */
export async function criarPost(
  slug: string,
  token: string,
  _estado: EstadoPost,
  formData: FormData
): Promise<EstadoPost> {
  const ficha = await getFichaAlunoPublica(token, slug);
  if (!ficha || ficha.academia.slug_url !== slug) {
    return { erro: "Link inválido." };
  }

  const legenda = String(formData.get("legenda") ?? "").trim();
  const arquivo = formData.get("imagem") as File | null;
  const temImagem = arquivo && arquivo.size > 0;

  if (!legenda && !temImagem) {
    return { erro: "Escreva algo ou anexe uma imagem." };
  }

  let extensao: string | undefined;
  if (temImagem) {
    const validado = validarImagemComunidade(arquivo);
    if ("erro" in validado) return { erro: validado.erro };
    extensao = validado.extensao;
  }

  const supabase = createClient();

  // Anti-spam: no máx. 6 publicações a cada 5 min por IP+token.
  const { data: liberado } = await supabase.rpc("acao_permitida", {
    p_chave: `post:${token}:${ipCliente()}`,
    p_max: 6,
    p_janela_seg: 300,
  });
  if (liberado === false) {
    return {
      erro: "Muitas publicações em pouco tempo. Tente novamente em alguns minutos.",
    };
  }

  let imagemUrl: string | null = null;
  if (temImagem && arquivo && extensao) {
    const enviado = await enviarImagemComunidade(
      ficha.academia.id,
      ficha.aluno.id,
      arquivo,
      extensao
    );
    if ("erro" in enviado) return { erro: enviado.erro };
    imagemUrl = enviado.url;
  }

  const { data, error } = await supabase.rpc("criar_post_comunidade", {
    p_token: token,
    p_slug: slug,
    p_legenda: legenda || null,
    p_imagem_url: imagemUrl,
  });

  if (error || !data) {
    return { erro: "Não foi possível publicar. Tente novamente." };
  }

  revalidatePath(`/aluno/${slug}/${token}/comunidade`);
  return { ok: true, post: data as PostComunidade, savedAt: Date.now() };
}

/** Curte ou descurte uma publicação. Idempotente (a RPC trata conflito). */
export async function alternarCurtida(
  slug: string,
  token: string,
  postId: string,
  curtir: boolean
): Promise<EstadoCurtida> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    curtir ? "curtir_post_comunidade" : "descurtir_post_comunidade",
    { p_token: token, p_slug: slug, p_post_id: postId }
  );
  if (error || !data) {
    return { erro: "Não foi possível registrar sua curtida." };
  }
  const r = data as { post_id: string; curtido_por_mim: boolean; total_curtidas: number };
  return { postId: r.post_id, curtido: r.curtido_por_mim, total: r.total_curtidas };
}

/** Comenta uma publicação. Devolve o comentário criado para inserção otimista. */
export async function comentarPost(
  slug: string,
  token: string,
  postId: string,
  texto: string
): Promise<EstadoComentario> {
  const limpo = texto.trim();
  if (!limpo) return { erro: "Escreva um comentário." };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("comentar_post_comunidade", {
    p_token: token,
    p_slug: slug,
    p_post_id: postId,
    p_texto: limpo,
  });
  if (error || !data) {
    return { erro: "Não foi possível comentar. Tente novamente." };
  }
  return { comentario: data as ComentarioComunidade };
}

/** Exclui a própria publicação (soft-delete). */
export async function excluirPost(
  slug: string,
  token: string,
  postId: string
): Promise<EstadoSimples> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("excluir_post_comunidade", {
    p_token: token,
    p_slug: slug,
    p_post_id: postId,
  });
  if (error || !(data as { removido?: boolean })?.removido) {
    return { erro: "Não foi possível excluir a publicação." };
  }
  revalidatePath(`/aluno/${slug}/${token}/comunidade`);
  return { ok: true };
}

/** Exclui o próprio comentário (soft-delete). */
export async function excluirComentario(
  slug: string,
  token: string,
  comentarioId: string
): Promise<EstadoSimples> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("excluir_comentario_comunidade", {
    p_token: token,
    p_slug: slug,
    p_comentario_id: comentarioId,
  });
  if (error || !(data as { removido?: boolean })?.removido) {
    return { erro: "Não foi possível excluir o comentário." };
  }
  return { ok: true };
}

/** Denuncia uma publicação (uma por aluno+post). */
export async function denunciarPost(
  slug: string,
  token: string,
  postId: string,
  motivo: string
): Promise<EstadoSimples> {
  const supabase = createClient();
  const { error } = await supabase.rpc("denunciar_post_comunidade", {
    p_token: token,
    p_slug: slug,
    p_post_id: postId,
    p_motivo: motivo.trim() || null,
  });
  if (error) {
    return { erro: "Não foi possível enviar a denúncia." };
  }
  return { ok: true };
}
