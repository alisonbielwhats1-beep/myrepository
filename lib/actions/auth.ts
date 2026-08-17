"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { erroAmigavel } from "../erros-servidor";
import { validarNovaSenha, validarAlteracaoSenha } from "../senha";

export type EstadoLogin = { erro?: string };

/**
 * IP real do cliente para o rate limit. NÃO usar o primeiro item de
 * `x-forwarded-for`: esse valor é o mais à esquerda e pode ser forjado pelo
 * cliente (basta mandar o header), permitindo burlar o bloqueio a cada
 * tentativa. Preferimos `x-real-ip` (preenchido pela plataforma/Vercel) e,
 * como fallback, o ÚLTIMO hop do XFF (adicionado pelo proxy confiável).
 */
function ipDoCliente(): string {
  const h = headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = h.get("x-forwarded-for") ?? "";
  const partes = fwd.split(",").map((p) => p.trim()).filter(Boolean);
  return partes[partes.length - 1] || "desconhecido";
}

/** Autentica o administrador e redireciona para o painel da sua academia. */
export async function entrarAction(
  _estado: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  // Minúsculo aqui também, não só no cadastro: o e-mail é gravado normalizado
  // por criarMembroEquipe e por criarAcademia, então digitar "JOAO@GMAIL.COM"
  // no login precisa casar com o "joao@gmail.com" guardado. Sem esta linha, a
  // pessoa que deixa o CAPS LOCK ligado — ou o teclado do celular que
  // capitaliza a primeira letra sozinho — recebe "E-mail ou senha inválidos"
  // sem ter errado nada, e ainda alimenta o contador de tentativas.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = createClient();
  // Rate limit: as funções são service_role-only (migration 078) — a anon key é
  // pública e não pode manipular o contador. O signInWithPassword abaixo segue
  // no cliente anon (fluxo de auth normal, que grava o cookie de sessão).
  const rateLimit = createServiceRoleClient();
  const ip = ipDoCliente();

  // Rate limit anti-brute-force: bloqueia o IP após muitas falhas seguidas.
  const { data: espera } = await rateLimit.rpc("login_espera_segundos", {
    p_chave: ip,
  });
  if (typeof espera === "number" && espera > 0) {
    const minutos = Math.ceil(espera / 60);
    return {
      erro: `Muitas tentativas de login. Aguarde ${minutos} minuto${
        minutos > 1 ? "s" : ""
      } e tente novamente.`,
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    // Registra a falha (pode disparar o bloqueio do IP).
    await rateLimit.rpc("login_registrar_falha", { p_chave: ip });
    return { erro: "E-mail ou senha inválidos." };
  }

  // Login válido: zera o contador do IP.
  await rateLimit.rpc("login_registrar_sucesso", { p_chave: ip });

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (adminEmails.includes(data.user.email?.toLowerCase() ?? "")) {
    redirect("/admin");
  }

  const { data: perfil } = await supabase
    .from("perfis_admin")
    .select("academia:academias(slug_url)")
    .eq("id", data.user.id)
    .maybeSingle();

  const slug = (perfil?.academia as unknown as { slug_url: string } | null)
    ?.slug_url;

  if (!slug) {
    await supabase.auth.signOut();
    return {
      erro:
        "Este login não está vinculado a nenhuma academia. Fale com o suporte.",
    };
  }

  redirect(`/painel/${slug}`);
}

/** Encerra a sessão do administrador. */
export async function sairAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Recuperação de senha
// ---------------------------------------------------------------------------

export type EstadoReset = { erro?: string; ok?: boolean };

/** URL base do site (para o link do e-mail de recuperação). */
function urlBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Envia o e-mail com o link de redefinição de senha. Por segurança, retorna
 * sucesso mesmo se o e-mail não existir (não revela quais e-mails têm conta).
 */
export async function solicitarResetSenha(
  _estado: EstadoReset,
  formData: FormData
): Promise<EstadoReset> {
  // Minúsculo pelo mesmo motivo do login: o e-mail é gravado normalizado, e
  // "JOAO@" precisa casar com "joao@" para o Supabase achar a conta.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { erro: "Informe um e-mail válido." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Rota DEDICADA e SEM query string. O fluxo antigo mandava
    // `/auth/callback?next=/redefinir-senha`, e o `?next=...` não batia com a
    // allow-list de Redirect URLs do Supabase — o link caía no Site URL (a
    // home) em vez da tela de nova senha. `/auth/recuperar` recebe só o `?code`
    // que o próprio Supabase anexa, então uma entrada simples na allow-list
    // resolve. Ver docs/supabase-auth-setup.md.
    redirectTo: `${urlBase()}/auth/recuperar`,
  });

  // O erro NÃO volta para a tela: os motivos reais de falha aqui (limite de
  // envio atingido, SMTP recusando) só acontecem quando o e-mail existe de
  // fato, então mostrá-los entregaria quais contas existem — justamente o que
  // a resposta genérica abaixo evita.
  //
  // Mas ele também não pode sumir. Antes o retorno era descartado, e um limite
  // de envio do provedor ficava indistinguível de "entregue": a tela dizia
  // "enviamos" nas duas situações. Foi assim que quatro pedidos seguidos
  // renderam dois e-mails sem nenhum registro do que houve com os outros dois.
  // `erroAmigavel` grava no console do servidor e em `logs_erros`, que alimenta
  // /admin/atividade — é lá que se enxerga a causa.
  if (error) {
    await erroAmigavel(error, "enviar o link de recuperação de senha");
  }

  return { ok: true };
}

/**
 * Redefine a senha do usuário na sessão de recuperação (após clicar no link do
 * e-mail, que estabelece uma sessão temporária via /auth/recuperar).
 *
 * A sessão de recuperação é a AUTORIZAÇÃO: só quem clicou no link recente do
 * próprio e-mail chega aqui com um `user` válido. Por isso este fluxo NÃO pede
 * a senha atual — quem esqueceu a senha não a tem. Diferente de
 * `alterarSenhaAction`, que roda com o usuário já logado e exige a atual.
 */
export async function redefinirSenhaAction(
  _estado: EstadoReset,
  formData: FormData
): Promise<EstadoReset> {
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  const erroFormato = validarNovaSenha(senha, confirmar);
  if (erroFormato) return { erro: erroFormato };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      erro: "Link de recuperação inválido ou expirado. Solicite um novo.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return { erro: await erroAmigavel(error, "redefinir a senha") };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Alteração de senha com o usuário JÁ LOGADO (área "Minha conta")
// ---------------------------------------------------------------------------

export type EstadoAlterarSenha = { erro?: string; ok?: boolean };

/**
 * Troca a senha de quem está logado, exigindo a senha ATUAL antes.
 *
 * Por que reautenticar: `updateUser({ password })` do Supabase não pede a senha
 * antiga. Sem a checagem abaixo, qualquer pessoa numa sessão deixada aberta no
 * balcão trocaria a senha e trancaria o dono para fora. A verificação é um
 * `signInWithPassword` com o e-mail da própria sessão — é o mesmo usuário, então
 * a sessão não muda; só confirma que quem está ali sabe a senha vigente.
 *
 * Serve a TODOS os papéis (dono, gerente, recepção, instrutor): cada um tem seu
 * próprio login e só troca a própria senha — `getSessao()` amarra a operação ao
 * `auth.uid()` atual, nunca a um id vindo do formulário.
 */
export async function alterarSenhaAction(
  _estado: EstadoAlterarSenha,
  formData: FormData
): Promise<EstadoAlterarSenha> {
  const atual = String(formData.get("senha_atual") ?? "");
  const nova = String(formData.get("senha_nova") ?? "");
  const confirmar = String(formData.get("senha_confirmar") ?? "");

  const erroFormato = validarAlteracaoSenha(atual, nova, confirmar);
  if (erroFormato) return { erro: erroFormato };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  // Reautenticação: confirma a senha atual antes de deixar trocar. Mesmo
  // usuário, então re-emitir a sessão é inofensivo.
  const { error: erroReauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: atual,
  });
  if (erroReauth) {
    return { erro: "A senha atual está incorreta." };
  }

  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) {
    return { erro: await erroAmigavel(error, "alterar a senha") };
  }

  return { ok: true };
}
