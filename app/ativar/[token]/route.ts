import { NextRequest, NextResponse } from "next/server";
import { tokenTemFormatoValido } from "@/lib/convites";
import { COOKIE_CONVITE, COOKIE_CONVITE_MAX_AGE } from "@/lib/ativacao-cookie";

/**
 * Entrada do convite. Recebe o token no PATH, valida o formato, guarda o token
 * no cookie seguro (HttpOnly/Secure/SameSite=Lax) e redireciona para /ativar —
 * uma URL LIMPA, sem o token. Assim o token sai da barra de endereço e do
 * histórico logo na primeira navegação, e nunca aparece em Referer/analytics
 * nas telas seguintes. Toda a validação real do convite acontece no servidor
 * (RPCs preview/ativar), nunca aqui.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token ?? "";
  const destinoOk = new URL("/ativar", _req.url);
  const destinoErro = new URL("/ativar?erro=invalido", _req.url);

  if (!tokenTemFormatoValido(token)) {
    return NextResponse.redirect(destinoErro);
  }

  const res = NextResponse.redirect(destinoOk);
  res.cookies.set(COOKIE_CONVITE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_CONVITE_MAX_AGE,
  });
  return res;
}
