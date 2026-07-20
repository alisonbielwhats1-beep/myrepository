"use server";

import { revalidatePath } from "next/cache";
import { requireSecao } from "@/lib/auth"
import type { EstadoAcao } from "@/lib/types";
import { LIMITE_MEMBROS_EQUIPE } from "@/lib/permissoes";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { Papel } from "@/lib/types";

const PAPEIS_VALIDOS: Papel[] = ["dono", "gerente", "recepcao", "instrutor"];

/**
 * Cria um novo usuário da equipe direto pelo app: cria o login no Supabase
 * Auth (via service role) e vincula à academia com o papel escolhido.
 * Só o "dono" pode chamar. Limitado a LIMITE_MEMBROS_EQUIPE por academia.
 */
export async function criarMembroEquipe(
  slug: string,
  _estado: EstadoAcao,
  formData: FormData
): Promise<EstadoAcao> {
  const sessao = await requireSecao(slug, "equipe");
  if (sessao.papel !== "dono") {
    return { erro: "Apenas o dono pode adicionar membros à equipe." };
  }

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const papel = String(formData.get("papel") ?? "recepcao") as Papel;

  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "E-mail inválido." };
  if (senha.length < 8) return { erro: "A senha precisa ter pelo menos 8 caracteres." };
  if (!PAPEIS_VALIDOS.includes(papel)) return { erro: "Papel inválido." };

  const supabase = createClient();
  const { count } = await supabase
    .from("perfis_admin")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", sessao.academia.id);

  if ((count ?? 0) >= LIMITE_MEMBROS_EQUIPE) {
    return {
      erro: `Limite de ${LIMITE_MEMBROS_EQUIPE} pessoas na equipe atingido. Remova alguém antes de adicionar outro.`,
    };
  }

  const admin = createServiceRoleClient();
  const { data: novoUsuario, error: erroUsuario } =
    await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });

  if (erroUsuario || !novoUsuario?.user) {
    const msg = erroUsuario?.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      return { erro: "Já existe um usuário com este e-mail." };
    }
    return { erro: `Falha ao criar o login: ${msg || "erro desconhecido"}` };
  }

  const { error: erroPerfil } = await admin.from("perfis_admin").insert({
    id: novoUsuario.user.id,
    academia_id: sessao.academia.id,
    nome,
    email,
    papel,
  });

  if (erroPerfil) {
    await admin.auth.admin.deleteUser(novoUsuario.user.id);
    return { erro: `Falha ao vincular o perfil: ${erroPerfil.message}` };
  }

  revalidatePath(`/painel/${slug}/equipe`);
  return { ok: true, savedAt: Date.now() };
}

/** Remove um membro da equipe (login + perfil). Só o dono pode. */
export async function removerMembroEquipe(
  slug: string,
  perfilId: string
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "equipe");
  if (sessao.papel !== "dono") {
    return { erro: "Apenas o dono pode remover membros." };
  }
  if (perfilId === sessao.userId) {
    return { erro: "Você não pode remover a si mesmo." };
  }

  const supabase = createClient();
  const { data: perfil } = await supabase
    .from("perfis_admin")
    .select("id")
    .eq("id", perfilId)
    .eq("academia_id", sessao.academia.id)
    .maybeSingle();
  if (!perfil) return { erro: "Membro não encontrado." };

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(perfilId);
  if (error) return { erro: `Falha ao remover: ${error.message}` };

  revalidatePath(`/painel/${slug}/equipe`);
  return { ok: true };
}

/** Altera o papel de um membro da equipe. Só o dono pode fazer isso. */
export async function alterarPapel(
  slug: string,
  perfilId: string,
  papel: string
): Promise<{ erro?: string; ok?: boolean }> {
  const sessao = await requireSecao(slug, "equipe");
  if (sessao.papel !== "dono") {
    return { erro: "Apenas o dono pode alterar papéis." };
  }
  if (!PAPEIS_VALIDOS.includes(papel as Papel)) {
    return { erro: "Papel inválido." };
  }
  if (perfilId === sessao.userId) {
    return { erro: "Você não pode alterar o seu próprio papel." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("perfis_admin")
    .update({ papel })
    .eq("id", perfilId)
    .eq("academia_id", sessao.academia.id);
  if (error) return { erro: `Falha ao atualizar: ${error.message}` };

  revalidatePath(`/painel/${slug}/equipe`);
  return { ok: true };
}
