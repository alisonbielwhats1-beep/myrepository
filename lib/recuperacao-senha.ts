/**
 * Decisão de o que fazer quando o navegador volta de um link de recuperação de
 * senha — lógica pura, sem Supabase e sem React, para poder ser testada.
 *
 * POR QUE ISSO EXISTE
 *   O link do e-mail aponta para `/auth/v1/verify` do Supabase, que valida o
 *   token e redireciona para o `redirect_to` que pedimos. Se esse destino não
 *   estiver EXATAMENTE na allow-list de Redirect URLs do projeto, o Supabase
 *   ignora o pedido e joga o usuário no **Site URL** — a home do app. Foi o que
 *   aconteceu: o cliente clicava em "Redefinir senha" e caía na tela inicial,
 *   às vezes já autenticado numa sessão de recuperação, sem nunca ver o
 *   formulário de nova senha.
 *
 *   Depender da allow-list é frágil: qualquer domínio novo (preview da Vercel,
 *   domínio próprio) quebra o fluxo de novo, e o usuário só descobre tentando
 *   trocar a senha. Então o app passa a reconhecer o retorno de recuperação
 *   **em qualquer página** e levar a pessoa para a tela certa por conta própria.
 *
 * FORMATOS QUE O SUPABASE PODE DEVOLVER (todos tratados aqui)
 *   • `?code=...`                        → fluxo PKCE (troca por sessão);
 *   • `?token_hash=...&type=recovery`    → verificação direta (funciona até em
 *                                          outro navegador/celular);
 *   • `#access_token=...&type=recovery`  → fluxo implícito, no fragmento;
 *   • `?error=...&error_code=otp_expired`→ link velho, já usado ou adulterado
 *     (também pode vir no fragmento).
 *
 * Recuperação de senha é o ÚNICO fluxo de link por e-mail do produto (contas de
 * dono e equipe são criadas já confirmadas, por `admin.createUser`), então um
 * `code` que chega numa página do painel só pode ser recuperação — não há
 * convite nem magic link para confundir.
 */

/** Tela onde o usuário digita a nova senha. */
export const PAGINA_NOVA_SENHA = "/redefinir-senha";

/** Tela para pedir um novo link quando o atual falhou. */
export const PAGINA_PEDIR_LINK = "/recuperar-senha";

export type AcaoRecuperacao =
  /** Nada a ver com recuperação — a página segue normal. */
  | { tipo: "ignorar" }
  /** Fluxo PKCE: trocar o `code` por uma sessão. */
  | { tipo: "trocar_code"; code: string }
  /** Verificar o token direto (serve entre navegadores/dispositivos). */
  | { tipo: "verificar_token"; tokenHash: string }
  /** Sessão já vem no fragmento; o SDK do Supabase a estabelece sozinho. */
  | { tipo: "sessao_no_fragmento" }
  /** O próprio Supabase informou falha (link expirado, já usado…). */
  | { tipo: "erro"; codigo: string; mensagem: string };

/**
 * Rotas que NÃO devem ser interceptadas no cliente:
 *   • `/auth/*` são route handlers do servidor, que já fazem a troca do token;
 *   • a área do aluno e o treino público não têm login de painel — o token de
 *     recuperação nunca pertence a elas, e mexer ali só criaria efeito colateral.
 */
function rotaIgnorada(pathname: string): boolean {
  return (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/aluno/") ||
    pathname.startsWith("/treino/")
  );
}

/** Mensagem em português para os erros que o Supabase devolve na URL. */
export function mensagemErroRecuperacao(codigo: string, descricao = ""): string {
  const c = codigo.toLowerCase();
  if (c.includes("expired") || c === "otp_expired") {
    return "Esse link de recuperação expirou. Peça um novo abaixo.";
  }
  if (c.includes("used")) {
    return "Esse link já foi usado. Peça um novo abaixo.";
  }
  if (c === "access_denied") {
    return "Não foi possível validar esse link. Peça um novo abaixo.";
  }
  return descricao.trim()
    ? "Não foi possível usar esse link: " + descricao.trim()
    : "Link de recuperação inválido ou expirado. Peça um novo abaixo.";
}

/**
 * Lê a URL atual e decide o que fazer. `search` e `hash` podem vir com ou sem
 * os prefixos `?`/`#`.
 */
export function analisarRetornoRecuperacao({
  pathname,
  search = "",
  hash = "",
}: {
  pathname: string;
  search?: string;
  hash?: string;
}): AcaoRecuperacao {
  if (rotaIgnorada(pathname)) return { tipo: "ignorar" };

  const q = new URLSearchParams(search.replace(/^\?/, ""));
  const f = new URLSearchParams(hash.replace(/^#/, ""));

  // 1. Erro explícito vem antes de tudo: não há token para usar.
  const erro = q.get("error") ?? f.get("error");
  const erroCodigo = q.get("error_code") ?? f.get("error_code");
  if (erro || erroCodigo) {
    const codigo = erroCodigo ?? erro ?? "";
    const descricao =
      q.get("error_description") ?? f.get("error_description") ?? "";
    return {
      tipo: "erro",
      codigo,
      mensagem: mensagemErroRecuperacao(codigo, descricao),
    };
  }

  // 2. Sessão no fragmento (fluxo implícito). Exige o access_token: um
  //    `#type=recovery` sozinho não estabelece sessão nenhuma.
  if (f.get("access_token") && ehTipoRecuperacao(f.get("type"))) {
    return { tipo: "sessao_no_fragmento" };
  }

  // 3. Token para verificar direto — o formato que funciona mesmo quando o
  //    e-mail é aberto em outro navegador (não depende do code_verifier local).
  const tokenHash = q.get("token_hash") ?? f.get("token_hash");
  if (tokenHash && ehTipoRecuperacao(q.get("type") ?? f.get("type"))) {
    return { tipo: "verificar_token", tokenHash };
  }

  // 4. Fluxo PKCE. Sem `type` na URL, mas recuperação é o único fluxo de link
  //    por e-mail do produto (ver cabeçalho), então é seguro assumir.
  const code = q.get("code");
  if (code) return { tipo: "trocar_code", code };

  return { tipo: "ignorar" };
}

function ehTipoRecuperacao(tipo: string | null): boolean {
  return tipo === "recovery" || tipo === "password_recovery";
}

/**
 * Depois de a sessão de recuperação existir, o usuário precisa ir para a tela
 * de nova senha — a menos que já esteja nela (evita um replace em loop).
 */
export function precisaIrParaNovaSenha(pathname: string): boolean {
  return pathname !== PAGINA_NOVA_SENHA;
}
