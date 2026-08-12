/**
 * Testes de lib/redirecionamento.ts — proteção contra open redirect.
 * Roda com: npm run test:redirecionamento
 *
 * Um `next`/`returnTo` malicioso não pode virar redirect para fora do site.
 * Estes casos são exatamente os vetores clássicos (//host, http://, backslash,
 * javascript:, controle) que a função precisa barrar.
 */
import {
  caminhoInternoSeguro,
  ehCaminhoInternoSeguro,
} from "../.test-build-redir/redirecionamento.js";

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

console.log("\n1. Caminhos internos legítimos passam");
{
  check("/painel", caminhoInternoSeguro("/painel") === "/painel");
  check("/painel/geracao-saude/alunos", caminhoInternoSeguro("/painel/geracao-saude/alunos") === "/painel/geracao-saude/alunos");
  check("/ativar/abc com query", caminhoInternoSeguro("/ativar/abc?x=1") === "/ativar/abc?x=1");
}

console.log("\n2. Redirects externos/perigosos caem no fallback");
{
  const F = "/";
  check("//evil.com -> fallback", caminhoInternoSeguro("//evil.com") === F);
  check("/\\evil.com -> fallback", caminhoInternoSeguro("/\\evil.com") === F);
  check("http://evil.com -> fallback", caminhoInternoSeguro("http://evil.com") === F);
  check("https://evil.com -> fallback", caminhoInternoSeguro("https://evil.com") === F);
  check("javascript:alert(1) -> fallback", caminhoInternoSeguro("javascript:alert(1)") === F);
  check("data:text/html -> fallback", caminhoInternoSeguro("data:text/html,x") === F);
  check("relativo sem barra -> fallback", caminhoInternoSeguro("painel") === F);
  check("vazio -> fallback", caminhoInternoSeguro("") === F);
  check("espaço no meio -> fallback", caminhoInternoSeguro("/pai nel") === F);
  check("null -> fallback", caminhoInternoSeguro(null) === F);
  check("número -> fallback", caminhoInternoSeguro(42) === F);
  check("fallback customizado é respeitado", caminhoInternoSeguro("//x", "/login") === "/login");
}

console.log("\n3. ehCaminhoInternoSeguro — booleano coerente");
{
  check("/painel é seguro", ehCaminhoInternoSeguro("/painel") === true);
  check("//evil não é seguro", ehCaminhoInternoSeguro("//evil.com") === false);
  check("http externo não é seguro", ehCaminhoInternoSeguro("http://x") === false);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
if (falhou > 0) process.exit(1);
