import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino do link do e-mail de "Esqueci minha senha" (ver solicitarResetSenha).
 *
 * POR QUE ESTA ROTA EXISTE, SEPARADA DE /auth/callback
 *   O fluxo antigo mandava o e-mail para `/auth/callback?next=/redefinir-senha`.
 *   O `?next=...` fazia a URL não bater com a allow-list de Redirect URLs do
 *   Supabase, que então caía no Site URL (a home). Resultado: o cliente clicava
 *   no link e ia parar na página inicial, sem nunca chegar à tela de nova senha.
 *
 *   Esta rota não recebe query nenhuma da nossa parte — só o `?code` que o
 *   próprio Supabase anexa. Uma entrada limpa na allow-list
 *   (`.../auth/recuperar`) resolve, e o destino final (/redefinir-senha) é
 *   decidido AQUI no servidor, não por parâmetro de URL.
 *
 * Troca o código PKCE por uma sessão de recuperação e manda para a tela de
 * nova senha. Código ausente ou inválido (link velho, já usado, adulterado)
 * volta para /recuperar-senha com um aviso claro, em vez de deixar o usuário
 * numa tela que só falha ao enviar.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/recuperar-senha?erro=expirado`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/recuperar-senha?erro=expirado`);
  }

  return NextResponse.redirect(`${origin}/redefinir-senha`);
}
