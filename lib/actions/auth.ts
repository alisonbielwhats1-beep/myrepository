"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string };

/** IP do cliente para o rate limit (Vercel popula x-forwarded-for). */
function ipDoCliente(): string {
  const fwd = headers().get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() || "desconhecido";
}

/** Autentica o administrador e redireciona para o painel da sua academia. */
export async function entrarAction(
  _estado: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = createClient();
  const ip = ipDoCliente();

  // Rate limit anti-brute-force: bloqueia o IP após muitas falhas seguidas.
  const { data: espera } = await supabase.rpc("login_espera_segundos", {
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
    await supabase.rpc("login_registrar_falha", { p_chave: ip });
    return { erro: "E-mail ou senha inválidos." };
  }

  // Login válido: zera o contador do IP.
  await supabase.rpc("login_registrar_sucesso", { p_chave: ip });

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
  const email = String(formData.get("email") ?? "").trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { erro: "Informe um e-mail válido." };
  }

  const supabase = createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${urlBase()}/auth/callback?next=/redefinir-senha`,
  });

  return { ok: true };
}

/**
 * Redefine a senha do usuário na sessão de recuperação (após clicar no link do
 * e-mail, que estabelece uma sessão temporária via /auth/callback).
 */
export async function redefinirSenhaAction(
  _estado: EstadoReset,
  formData: FormData
): Promise<EstadoReset> {
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  if (senha.length < 8) {
    return { erro: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (senha !== confirmar) {
    return { erro: "As senhas não coincidem." };
  }

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
    return { erro: `Não foi possível redefinir a senha: ${error.message}` };
  }

  return { ok: true };
}
