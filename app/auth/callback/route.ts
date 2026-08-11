import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback genérico de e-mail (confirmação, magic link, convites futuros).
 *
 * A recuperação de senha usa a rota DEDICADA /auth/recuperar, sem depender do
 * parâmetro `next` — ver o comentário lá. Este handler continua para os demais
 * fluxos que o Supabase possa direcionar para cá.
 *
 * `next` é restrito a caminho interno (começa com "/" e não com "//"): sem
 * isso, um `next=https://site-malicioso` transformaria o callback num open
 * redirect. Troca de código falha -> volta para /login com aviso, nunca joga
 * o usuário num /painel sem sessão.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/painel";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/painel";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
