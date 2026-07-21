"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { PlanoSaas } from "@/lib/types";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/painel");
  }
}

export async function alterarPlano(academiaId: string, plano: PlanoSaas) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("academias")
    .update({ plano_saas: plano })
    .eq("id", academiaId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function criarAcademia(
  formData: FormData
): Promise<{ erro?: string; slug?: string }> {
  await requireAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();
  const adminNome = String(formData.get("adminNome") ?? "").trim() || nome;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;

  if (!nome || !slug || !email || !senha) {
    return { erro: "Preencha todos os campos obrigatórios." };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return {
      erro:
        "O slug deve ter entre 3 e 50 caracteres, usar apenas letras minúsculas, números e hífen, e não pode começar ou terminar com hífen.",
    };
  }
  if (senha.length < 8) {
    return { erro: "A senha deve ter pelo menos 8 caracteres." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { erro: "E-mail inválido." };
  }

  const supabase = createServiceRoleClient();

  const { data: academia, error: erroAcademia } = await supabase
    .from("academias")
    .insert({ nome_fantasia: nome, slug_url: slug, telefone })
    .select()
    .single();

  if (erroAcademia || !academia) {
    const msg = erroAcademia?.message ?? "erro desconhecido";
    return {
      erro:
        msg.includes("duplicate") || msg.includes("unique")
          ? "Esse slug já está em uso. Escolha outro."
          : `Erro ao criar academia: ${msg}`,
    };
  }

  const { data: usuario, error: erroUsuario } =
    await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: adminNome },
    });

  if (erroUsuario || !usuario?.user) {
    await supabase.from("academias").delete().eq("id", academia.id);
    return {
      erro: `Erro ao criar usuário: ${erroUsuario?.message ?? "erro desconhecido"}`,
    };
  }

  const { error: erroPerfil } = await supabase.from("perfis_admin").insert({
    id: usuario.user.id,
    academia_id: academia.id,
    nome: adminNome,
    email,
  });

  if (erroPerfil) {
    await supabase.auth.admin.deleteUser(usuario.user.id);
    await supabase.from("academias").delete().eq("id", academia.id);
    return { erro: `Erro ao vincular perfil: ${erroPerfil.message}` };
  }

  // Popula a biblioteca de treinos-modelo padrão (migration 018). Se a função
  // ainda não existir no banco, não bloqueia a criação da academia.
  const { error: erroSeed } = await supabase.rpc("seed_treinos_padrao", {
    p_academia_id: academia.id,
  });
  if (erroSeed) {
    console.error("[criarAcademia] falha ao popular treinos padrão:", erroSeed.message);
  }

  revalidatePath("/admin");
  return { slug };
}

/**
 * Edita o login (e-mail e/ou senha) do dono de uma academia. Atualiza tanto o
 * Supabase Auth quanto o e-mail espelhado em perfis_admin.
 */
export async function editarLoginAcademia(
  academiaId: string,
  formData: FormData
): Promise<{ erro?: string; ok?: boolean }> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "").trim();

  if (!email) {
    return { erro: "Informe o e-mail." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { erro: "E-mail inválido." };
  }
  if (senha && senha.length < 8) {
    return { erro: "A senha deve ter pelo menos 8 caracteres." };
  }

  const supabase = createServiceRoleClient();

  // Localiza o login do dono desta academia (o mais antigo, papel 'dono').
  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfis_admin")
    .select("id, papel")
    .eq("academia_id", academiaId)
    .order("papel", { ascending: true }) // 'dono' vem antes de 'gerente' etc.
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroPerfil || !perfil) {
    return { erro: "Login desta academia não encontrado." };
  }

  // Atualiza o Auth (e-mail sempre; senha só se foi informada).
  const patch: { email: string; password?: string } = { email };
  if (senha) patch.password = senha;

  const { error: erroAuth } = await supabase.auth.admin.updateUserById(
    perfil.id,
    patch
  );
  if (erroAuth) {
    const msg = erroAuth.message;
    return {
      erro:
        msg.includes("already been registered") || msg.includes("duplicate")
          ? "Esse e-mail já está em uso por outro login."
          : `Erro ao atualizar login: ${msg}`,
    };
  }

  // Espelha o novo e-mail em perfis_admin.
  const { error: erroUpdate } = await supabase
    .from("perfis_admin")
    .update({ email })
    .eq("id", perfil.id);
  if (erroUpdate) {
    return { erro: `Login atualizado, mas falhou ao espelhar e-mail: ${erroUpdate.message}` };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function removerAcademia(
  academiaId: string
): Promise<{ erro?: string }> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  // Busca IDs dos usuários vinculados para deletar do Auth
  const { data: perfis } = await supabase
    .from("perfis_admin")
    .select("id")
    .eq("academia_id", academiaId);

  if (perfis) {
    for (const perfil of perfis) {
      await supabase.auth.admin.deleteUser(perfil.id);
    }
  }

  // Deleta a academia (CASCADE remove registros filhos)
  const { error } = await supabase
    .from("academias")
    .delete()
    .eq("id", academiaId);

  if (error) return { erro: error.message };

  revalidatePath("/admin");
  return {};
}
