/**
 * Testes do reconhecimento do retorno de recuperação de senha.
 *
 * Roda com: npm run test:recuperacao
 *
 * POR QUE ESTE TESTE EXISTE
 *   O link do e-mail de "Esqueci minha senha" caía na tela inicial em vez da
 *   tela de nova senha. A causa era o Supabase ignorar o `redirect_to` quando
 *   ele não bate com a allow-list de Redirect URLs e cair no Site URL (a home).
 *   O app passou a reconhecer o retorno em QUALQUER página, e o formato do
 *   token varia conforme o fluxo (PKCE, token_hash, fragmento) e a versão do
 *   Supabase. Estes testes fixam todos os formatos de uma vez, porque o fluxo
 *   real só pode ser testado com um e-mail de verdade — e já falhou duas vezes.
 */
import {
  PAGINA_NOVA_SENHA,
  analisarRetornoRecuperacao,
  mensagemErroRecuperacao,
  precisaIrParaNovaSenha,
} from "../.test-build-recuperacao/recuperacao-senha.js";

let passou = 0;
let falhou = 0;
function check(nome, cond, detalhe = "") {
  if (cond) {
    passou++;
    console.log(`  OK   ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHA ${nome} ${detalhe}`);
  }
}
function eqTipo(nome, acao, esperado) {
  check(nome, acao.tipo === esperado, `→ esperado "${esperado}", obtido "${acao.tipo}"`);
}

console.log("\n1. O bug relatado: link cai na HOME em vez da tela de senha");
// Fallback para o Site URL com o code anexado pelo Supabase.
{
  const a = analisarRetornoRecuperacao({ pathname: "/", search: "?code=abc123", hash: "" });
  eqTipo("home com ?code é reconhecida como recuperação", a, "trocar_code");
  check("code extraído", a.code === "abc123", a.code);
  check("e a pessoa é levada para a tela de nova senha", precisaIrParaNovaSenha("/"));
}
// Fallback com token no fragmento (fluxo implícito).
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "",
    hash: "#access_token=tok&refresh_token=ref&type=recovery",
  });
  eqTipo("home com #access_token&type=recovery", a, "sessao_no_fragmento");
}
// Fallback no /login (Site URL apontando para o login).
{
  const a = analisarRetornoRecuperacao({ pathname: "/login", search: "?code=xyz", hash: "" });
  eqTipo("login com ?code também é reconhecido", a, "trocar_code");
}

console.log("\n2. token_hash — formato que funciona entre navegadores/celulares");
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "?token_hash=hash123&type=recovery",
    hash: "",
  });
  eqTipo("token_hash + type=recovery", a, "verificar_token");
  check("tokenHash extraído", a.tokenHash === "hash123", a.tokenHash);
}
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "",
    hash: "#token_hash=hh&type=recovery",
  });
  eqTipo("token_hash no fragmento", a, "verificar_token");
}
// `type` alternativo que algumas versões enviam.
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "?token_hash=hh&type=password_recovery",
    hash: "",
  });
  eqTipo("type=password_recovery também vale", a, "verificar_token");
}

console.log("\n3. Erros que o Supabase devolve na própria URL");
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    hash: "",
  });
  eqTipo("link expirado é erro (não tenta trocar token)", a, "erro");
  check("mensagem em português menciona expirado", /expirou/i.test(a.mensagem), a.mensagem);
}
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "",
    hash: "#error=access_denied&error_code=otp_expired",
  });
  eqTipo("erro no fragmento também é detectado", a, "erro");
}
// Erro tem prioridade sobre token presente na mesma URL.
{
  const a = analisarRetornoRecuperacao({
    pathname: "/",
    search: "?code=abc&error_code=otp_expired",
    hash: "",
  });
  eqTipo("erro vence o code na mesma URL", a, "erro");
}

console.log("\n4. Mensagens de erro amigáveis");
check("otp_expired", /expirou/i.test(mensagemErroRecuperacao("otp_expired")));
check("token já usado", /já foi usado/i.test(mensagemErroRecuperacao("token_used")));
check("access_denied", /validar/i.test(mensagemErroRecuperacao("access_denied")));
check(
  "código desconhecido usa a descrição",
  mensagemErroRecuperacao("coisa_nova", "Algo específico").includes("Algo específico")
);
check(
  "sem código nem descrição ainda orienta",
  /peça um novo/i.test(mensagemErroRecuperacao("", ""))
);

console.log("\n5. Navegação normal não é afetada (nenhum falso positivo)");
for (const [nome, entrada] of [
  ["home limpa", { pathname: "/", search: "", hash: "" }],
  ["login limpo", { pathname: "/login", search: "", hash: "" }],
  ["painel", { pathname: "/painel/academia-x/treinos", search: "", hash: "" }],
  ["query sem token", { pathname: "/painel/x/alunos", search: "?busca=joao&pagina=2", hash: "" }],
  ["âncora comum", { pathname: "/", search: "", hash: "#planos" }],
  ["fragmento sem access_token", { pathname: "/", search: "", hash: "#type=recovery" }],
  ["filtro de treinos", { pathname: "/painel/x/treinos", search: "?nivel=todos", hash: "" }],
]) {
  eqTipo(nome, analisarRetornoRecuperacao(entrada), "ignorar");
}

console.log("\n6. Rotas que o gate NÃO intercepta");
// /auth/* são route handlers do servidor: eles já trocam o token.
eqTipo(
  "/auth/recuperar é do servidor",
  analisarRetornoRecuperacao({ pathname: "/auth/recuperar", search: "?code=abc", hash: "" }),
  "ignorar"
);
eqTipo(
  "/auth/callback é do servidor",
  analisarRetornoRecuperacao({ pathname: "/auth/callback", search: "?code=abc", hash: "" }),
  "ignorar"
);
// A área do aluno não tem login de painel — token de recuperação não é dela.
eqTipo(
  "app do aluno não é interceptado",
  analisarRetornoRecuperacao({ pathname: "/aluno/academia/tok123", search: "?code=abc", hash: "" }),
  "ignorar"
);
eqTipo(
  "treino público não é interceptado",
  analisarRetornoRecuperacao({ pathname: "/treino/token", search: "?code=abc", hash: "" }),
  "ignorar"
);

console.log("\n7. Já na tela de nova senha: consome o token, mas não redireciona em loop");
{
  const a = analisarRetornoRecuperacao({
    pathname: PAGINA_NOVA_SENHA,
    search: "?code=abc",
    hash: "",
  });
  eqTipo("token é processado na própria tela", a, "trocar_code");
  check(
    "não redireciona (evita loop)",
    precisaIrParaNovaSenha(PAGINA_NOVA_SENHA) === false
  );
}
check("de outra página, redireciona", precisaIrParaNovaSenha("/") === true);

console.log("\n8. Robustez de formato (prefixos ? e # opcionais)");
{
  const semPrefixo = analisarRetornoRecuperacao({
    pathname: "/",
    search: "code=abc",
    hash: "",
  });
  eqTipo("search sem '?'", semPrefixo, "trocar_code");
  const hashSemPrefixo = analisarRetornoRecuperacao({
    pathname: "/",
    search: "",
    hash: "access_token=t&type=recovery",
  });
  eqTipo("hash sem '#'", hashSemPrefixo, "sessao_no_fragmento");
  eqTipo(
    "search/hash ausentes",
    analisarRetornoRecuperacao({ pathname: "/" }),
    "ignorar"
  );
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
if (falhou > 0) process.exit(1);
