"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros-servidor";

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remove (soft-delete) uma publicação da comunidade pela moderação. A academia
 * e o papel (dono/gerente) são resolvidos dentro da RPC `remover_post_moderacao`
 * pela sessão — nunca por id do cliente. Uma academia nunca modera outra.
 */
export async function removerPostModeracao(
  slug: string,
  postId: string
): Promise<{ erro: string } | { ok: true }> {
  const sessao = await requireSecao(slug, "comunidade");
  if (sessao.papel !== "dono" && sessao.papel !== "gerente") {
    return { erro: "Seu perfil não pode moderar a comunidade." };
  }
  if (!FORMATO_UUID.test(postId)) {
    return { erro: "Publicação inválida." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("remover_post_moderacao", {
    p_post_id: postId,
  });

  if (error || !(data as { removido?: boolean })?.removido) {
    return { erro: await erroAmigavel(error, "remover a publicação") };
  }

  revalidatePath(`/painel/${slug}/comunidade`);
  return { ok: true };
}

/**
 * Restaura (desfaz o soft-delete) uma publicação tirada do ar pela moderação —
 * manual ou automática (auto-ocultar por denúncias). Academia e papel
 * (dono/gerente) resolvidos dentro da RPC pela sessão. Nunca reverte a exclusão
 * feita pelo próprio autor.
 */
export async function restaurarPostModeracao(
  slug: string,
  postId: string
): Promise<{ erro: string } | { ok: true }> {
  const sessao = await requireSecao(slug, "comunidade");
  if (sessao.papel !== "dono" && sessao.papel !== "gerente") {
    return { erro: "Seu perfil não pode moderar a comunidade." };
  }
  if (!FORMATO_UUID.test(postId)) {
    return { erro: "Publicação inválida." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("restaurar_post_moderacao", {
    p_post_id: postId,
  });

  if (error || !(data as { restaurado?: boolean })?.restaurado) {
    return { erro: await erroAmigavel(error, "restaurar a publicação") };
  }

  revalidatePath(`/painel/${slug}/comunidade`);
  return { ok: true };
}
