import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros-servidor";
import {
  PAGINA_NOVA_SENHA,
  PAGINA_PEDIR_LINK,
  mensagemErroRecuperacao,
} from "@/lib/recuperacao-senha";

/**
 * Destino do link do e-mail de "Esqueci minha senha" (ver solicitarResetSenha).
 *
 * POR QUE ESTA ROTA EXISTE, SEPARADA DE /auth/callback
 *   O fluxo antigo mandava o e-mail para `/auth/callback?next=/redefinir-senha`.
 *   O `?next=...` fazia a URL não bater com a allow-list de Redirect URLs do
 *   Supabase, que então caía no Site URL (a home). Esta rota não recebe query
 *   nenhuma da nossa parte — só o que o próprio Supabase anexa — então uma
 *   entrada limpa na allow-list (`.../auth/recuperar`) resolve, e o destino
 *   final é decidido AQUI no servidor, não por parâmetro de URL.
 *
 *   Ainda assim, o app NÃO depende só disto: se a allow-list divergir e o
 *   Supabase jogar o usuário na home, o GateRecuperacaoSenha (layout raiz)
 *   reconhece o retorno em qualquer página e traz para a tela de nova senha.
 *
 * FORMATOS ACEITOS
 *   • `?token_hash=...&type=recovery` → verificação direta. Preferido: funciona
 *     mesmo quando o e-mail é aberto em OUTRO navegador ou celular, porque não
 *     depende do code_verifier PKCE guardado no aparelho que pediu o link.
 *   • `?code=...` → troca PKCE (mesmo navegador).
 *   • `?error=...` → o Supabase já recusou o token (link velho/usado).
 *
 * Qualquer falha volta para /recuperar-senha com um aviso em português, em vez
 * de deixar o usuário numa tela de senha que só falha ao enviar.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  const pedirNovoLink = (mensagem: string) =>
    NextResponse.redirect(
      `${origin}${PAGINA_PEDIR_LINK}?aviso=${encodeURIComponent(mensagem)}`
    );

  // O Supabase pode recusar o token antes de chegar aqui.
  const erro = searchParams.get("error_code") ?? searchParams.get("error");
  if (erro) {
    const descricao = searchParams.get("error_description") ?? "";
    await registrar(
      { code: erro, message: descricao },
      "validar o link de recuperação (recusado pelo Supabase)"
    );
    return pedirNovoLink(mensagemErroRecuperacao(erro, descricao));
  }

  const supabase = createClient();
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      await registrar(error, "validar o link de recuperação (token_hash)");
      return pedirNovoLink(
        "Esse link de recuperação expirou ou já foi usado. Peça um novo abaixo."
      );
    }
    return NextResponse.redirect(`${origin}${PAGINA_NOVA_SENHA}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      await registrar(error, "trocar o código de recuperação por uma sessão");
      return pedirNovoLink(
        "Abra o link no mesmo navegador em que pediu a recuperação, ou peça um novo abaixo."
      );
    }
    return NextResponse.redirect(`${origin}${PAGINA_NOVA_SENHA}`);
  }

  // Sem token nenhum: link truncado pelo cliente de e-mail, ou acesso direto.
  // Mesmo assim mandamos para a tela de nova senha SE já houver sessão de
  // recuperação (o fragmento `#access_token` não chega ao servidor, então quem
  // resolve esse caso é o gate no cliente).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${origin}${PAGINA_NOVA_SENHA}`);
  }

  return pedirNovoLink(
    "Link de recuperação inválido ou incompleto. Peça um novo abaixo."
  );
}

/**
 * Registra a causa REAL da falha (console do servidor + `logs_erros`, que
 * alimenta /admin/atividade) sem mostrá-la ao usuário.
 *
 * Sem isto, "expirou", "já foi usado", "aberto em outro navegador" e "token
 * consumido por um antivírus de e-mail antes do clique" chegavam todos na tela
 * como a mesma frase, e não havia como saber qual dos quatro tinha acontecido.
 * A mensagem para o usuário segue genérica de propósito — o detalhe do erro
 * diria se aquele e-mail tem conta.
 */
async function registrar(
  erro: { code?: string | null; message?: string | null } | null,
  acao: string
): Promise<void> {
  try {
    await erroAmigavel(erro, acao);
  } catch {
    // Registrar a falha nunca pode virar uma segunda falha no fluxo de senha.
  }
}
