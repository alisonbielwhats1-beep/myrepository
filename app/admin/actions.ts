"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPlataforma as requireAdmin } from "@/lib/admin-plataforma";
import { PlanoSaas } from "@/lib/types";
import {
  normalizarEmail,
  normalizarNomeProprio,
  normalizarTelefone,
} from "@/lib/normalizacao";

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
  const email = normalizarEmail(formData.get("email") as string) ?? "";
  const senha = String(formData.get("senha") ?? "").trim();
  // `nome` (nome_fantasia) fica como o dono escreveu — é a marca dele. O nome
  // da PESSOA administradora é padronizado como qualquer outro cadastro: ele
  // assina cada linha do log de auditoria (usuario_nome).
  const adminNome = normalizarNomeProprio(formData.get("adminNome") as string) || nome;
  const telefone = normalizarTelefone(formData.get("telefone") as string);

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

/**
 * Exclui uma academia inteira — ação IRREVERSÍVEL: apaga a academia, todos os
 * dados por CASCADE (alunos, financeiro, treinos, etc.) e os logins da equipe
 * em `auth.users`. Apagar os logins é o que impede o e-mail de virar órfão:
 * sem isso, o endereço continuaria "já cadastrado" mesmo depois da academia
 * sumir, bloqueando reuso — foi exatamente o que aconteceu com contas de teste
 * antigas.
 *
 * DUAS TRAVAS, além de `requireAdmin` (só o superadmin da plataforma chega aqui):
 *   1. `confirmacaoNome` tem de bater EXATAMENTE com o nome da academia — obriga
 *      a olhar o que se está apagando, não é um clique no automático.
 *   2. `senha` é a senha de login do próprio admin, reconferida agora. Uma
 *      sessão aberta no balcão não apaga academia de ninguém sem saber a senha.
 *
 * A conferência de senha usa a sessão do admin (createClient), não o service
 * role — é a identidade real de quem está pedindo. A exclusão em si usa o
 * service role, que ignora RLS.
 */
export async function removerAcademia(
  academiaId: string,
  confirmacaoNome: string,
  senha: string
): Promise<{ erro?: string }> {
  const admin = await requireAdmin();

  if (!senha) return { erro: "Digite sua senha de login para confirmar." };

  const service = createServiceRoleClient();

  // Nome atual da academia — a confirmação tem de bater com ele.
  const { data: academia } = await service
    .from("academias")
    .select("nome_fantasia")
    .eq("id", academiaId)
    .maybeSingle();

  if (!academia) return { erro: "Academia não encontrada. Atualize a página." };

  if (confirmacaoNome.trim() !== academia.nome_fantasia.trim()) {
    return { erro: "O nome digitado não confere com o da academia." };
  }

  // Trava 2: reautenticação com a senha do admin logado.
  const sessao = createClient();
  const { error: erroSenha } = await sessao.auth.signInWithPassword({
    email: admin.email,
    password: senha,
  });
  if (erroSenha) return { erro: "Senha incorreta. A academia NÃO foi excluída." };

  // Apaga os logins da equipe no Auth (senão viram órfãos e travam o e-mail).
  const { data: perfis } = await service
    .from("perfis_admin")
    .select("id")
    .eq("academia_id", academiaId);

  if (perfis) {
    for (const perfil of perfis) {
      await service.auth.admin.deleteUser(perfil.id);
    }
  }

  // Deleta a academia (CASCADE remove alunos, financeiro, treinos, etc.).
  const { error } = await service
    .from("academias")
    .delete()
    .eq("id", academiaId);

  if (error) return { erro: `Não foi possível excluir: ${error.message}` };

  revalidatePath("/admin");
  return {};
}
