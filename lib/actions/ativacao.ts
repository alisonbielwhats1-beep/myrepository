"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  hashTokenConvite,
  tokenTemFormatoValido,
} from "@/lib/convites";
import { validarNovaSenha } from "@/lib/senha";
import { COOKIE_CONVITE, COOKIE_CONVITE_MAX_AGE } from "@/lib/ativacao-cookie";

// O CONTEXTO do convite viaja num cookie HttpOnly + Secure + SameSite=Lax:
// nunca é lido por JavaScript, nunca vai para URL/analytics/referer, e
// sobrevive ao retorno do provedor OAuth (mesmo site). Curto por design.

/** Grava o cookie seguro do convite (chamado ao abrir um convite válido). */
export async function guardarContextoConvite(tokenBruto: string): Promise<void> {
  if (!tokenTemFormatoValido(tokenBruto)) return;
  cookies().set(COOKIE_CONVITE, tokenBruto, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_CONVITE_MAX_AGE,
  });
}

/** Remove o cookie do convite (após consumir ou ao cancelar). Best-effort:
 * em render de Server Component a escrita de cookie lança — nesse caso o
 * cookie expira sozinho pelo maxAge curto e a RPC de ativação é idempotente. */
export async function limparContextoConvite(): Promise<void> {
  try {
    cookies().delete(COOKIE_CONVITE);
  } catch {
    // Sem permissão de escrita de cookie (RSC) — ignorável.
  }
}

/** URL base do site para os redirects de callback (domínio autorizado). */
function urlBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Destino do callback que retoma a ativação com a sessão já estabelecida. */
function redirectAtivacao(): string {
  // O `next` é interno e fixo — nunca vem do cliente. /ativar/continuar lê o
  // cookie do convite e finaliza o vínculo com a sessão recém-criada.
  return `${urlBase()}/auth/callback?next=${encodeURIComponent("/ativar/continuar")}`;
}

// ---------------------------------------------------------------------------
// Mensagens amigáveis para os erros das RPCs (nunca expõem tabela/Supabase).
// ---------------------------------------------------------------------------
function mensagemErroAtivacao(codigoOuMensagem: string): string {
  const m = codigoOuMensagem;
  if (m.includes("convite_expirado"))
    return "Este convite expirou. Peça um novo à sua academia.";
  if (m.includes("convite_revogado"))
    return "Este convite foi cancelado. Peça um novo à sua academia.";
  if (m.includes("convite_utilizado"))
    return "Este convite já foi utilizado. Se foi você, entre com o método que escolheu.";
  if (m.includes("convite_invalido"))
    return "Convite inválido. Confira o link recebido da sua academia.";
  if (m.includes("aluno_ja_vinculado"))
    return "Este cadastro já está vinculado a outra conta. Fale com a sua academia para revisão.";
  if (m.includes("conta_ja_vinculada_outro_aluno"))
    return "Sua conta já está vinculada a outro cadastro nesta academia. Fale com a sua academia.";
  if (m.includes("sem_sessao"))
    return "Sua sessão não foi reconhecida. Tente novamente.";
  return "Não foi possível concluir a ativação agora. Tente novamente em instantes.";
}

export type ResultadoAtivacao =
  | { ok: true; slug: string; jaAtivado: boolean }
  | { ok: false; erro: string };

/**
 * Finaliza a ativação: com a conta JÁ autenticada (auth.uid() presente), chama
 * a RPC atômica que vincula a conta ao aluno do convite e consome o convite.
 * Idempotente: reexecutar após reload/replay devolve sucesso sem duplicar.
 *
 * O token bruto vem do cookie seguro (não do cliente). Aqui só calculamos o
 * hash e delegamos ao banco, que faz toda a validação e o travamento.
 */
export async function finalizarAtivacao(): Promise<ResultadoAtivacao> {
  const tokenBruto = cookies().get(COOKIE_CONVITE)?.value;
  if (!tokenBruto || !tokenTemFormatoValido(tokenBruto)) {
    return { ok: false, erro: "Contexto do convite não encontrado. Reabra o link do convite já conectado à sua conta." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, erro: "Você precisa concluir o login antes de ativar." };
  }

  const hash = hashTokenConvite(tokenBruto);
  const { data, error } = await supabase.rpc("ativar_convite_acesso", {
    p_token_hash: hash,
  });

  // Erro inesperado do banco (não uma rejeição prevista, que vem como status).
  if (error) {
    return { ok: false, erro: mensagemErroAtivacao("") };
  }

  const resultado = (data ?? {}) as { academia_slug?: string; status?: string };
  const status = resultado.status ?? "";

  // Sucesso (ativado agora ou já estava ativado).
  if (status === "ativado" || status === "ja_ativado") {
    await limparContextoConvite();
    return {
      ok: true,
      slug: resultado.academia_slug ?? "",
      jaAtivado: status === "ja_ativado",
    };
  }

  // Rejeição prevista: mapeia o código para a mensagem amigável. O contexto do
  // convite é mantido só quando faz sentido tentar de novo (ex.: sem_sessao).
  return { ok: false, erro: mensagemErroAtivacao(status) };
}

export type EstadoCadastroEmail = { erro?: string; confirmar?: boolean };

/**
 * Cadastro manual com e-mail e senha durante a ativação. Cria a conta pelo
 * fluxo do Supabase Auth com CONFIRMAÇÃO DE E-MAIL obrigatória (não desativamos
 * a confirmação para reduzir atrito — prompt 7.5). O vínculo só acontece depois
 * que o e-mail é confirmado e a sessão volta por /ativar/continuar.
 *
 * O e-mail informado aqui é o e-mail de LOGIN escolhido pelo aluno — pode ser
 * diferente do e-mail de contato cadastrado pela academia. O convite (cookie)
 * é quem define QUAL aluno será ativado, não este e-mail.
 */
export async function cadastrarEmailSenhaAtivacao(
  _estado: EstadoCadastroEmail,
  formData: FormData
): Promise<EstadoCadastroEmail> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { erro: "Informe um e-mail válido." };
  }
  const erroSenha = validarNovaSenha(senha, confirmar);
  if (erroSenha) return { erro: erroSenha };

  // Precisa haver um convite em contexto para não criar conta órfã sem destino.
  const tokenBruto = cookies().get(COOKIE_CONVITE)?.value;
  if (!tokenBruto || !tokenTemFormatoValido(tokenBruto)) {
    return { erro: "Contexto do convite expirou. Reabra o link do convite." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: redirectAtivacao() },
  });

  if (error) {
    // Não confirma se o e-mail já existe (evita enumeração). Mensagem neutra
    // que também cobre o caso de e-mail já cadastrado: mande entrar.
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("registered") || msg.includes("already")) {
      return {
        erro: "Se este e-mail já tiver conta, entre por ele. Caso contrário, verifique o endereço e tente de novo.",
      };
    }
    return { erro: "Não foi possível criar a conta agora. Tente novamente." };
  }

  return { confirmar: true };
}
