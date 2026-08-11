/**
 * Testes de lib/normalizacao.ts (padronização do cadastro — 2026-08-11).
 *
 * Roda com: npm run test:normalizacao
 * Mesmo esquema dos outros testes do projeto: compila lib/normalizacao.ts para
 * .test-build-norm/ e roda com Node puro, sem framework.
 *
 * O foco dos casos abaixo é a garantia que foi prometida ao dono: normalizar
 * NUNCA recusa nem descarta o que o usuário digitou.
 */
import {
  normalizarNomeProprio,
  normalizarEmail,
  normalizarTelefone,
} from "../.test-build-norm/normalizacao.js";

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
function igual(nome, obtido, esperado) {
  check(nome, obtido === esperado, `-> "${obtido}" (esperado "${esperado}")`);
}

console.log("\n1. normalizarNomeProprio — o caso que originou a mudança");
{
  igual("CAIXA ALTA -> nome próprio", normalizarNomeProprio("MARIA DA SILVA SANTOS"), "Maria da Silva Santos");
  igual("tudo minúsculo -> nome próprio", normalizarNomeProprio("maria da silva santos"), "Maria da Silva Santos");
  igual("já correto -> inalterado", normalizarNomeProprio("Maria da Silva Santos"), "Maria da Silva Santos");
  igual("plano em caixa alta", normalizarNomeProprio("MENSAL PREMIUM"), "Mensal Premium");
}

console.log("\n2. normalizarNomeProprio — partículas");
{
  igual("da/de/dos no meio ficam minúsculas", normalizarNomeProprio("JOAO DOS SANTOS DE OLIVEIRA"), "Joao dos Santos de Oliveira");
  igual("partícula na 1ª palavra continua maiúscula", normalizarNomeProprio("DA SILVA"), "Da Silva");
  igual("'e' entre sobrenomes", normalizarNomeProprio("MARIA SILVA E SOUZA"), "Maria Silva e Souza");
  igual("van/von preservam a convenção", normalizarNomeProprio("ANA VAN DER BERG"), "Ana van Der Berg");
}

console.log("\n3. normalizarNomeProprio — compostos, acentos e romanos");
{
  igual("apóstrofo capitaliza os dois lados", normalizarNomeProprio("JOSE D'AVILA"), "Jose D'Avila");
  igual("hífen capitaliza os dois lados", normalizarNomeProprio("ANA-MARIA BRAGA"), "Ana-Maria Braga");
  igual("acento é preservado e capitalizado", normalizarNomeProprio("JOÃO ANDRÉ MÜLLER"), "João André Müller");
  igual("algarismo romano não vira palavra", normalizarNomeProprio("CARLOS NETO III"), "Carlos Neto III");
  igual("inicial com ponto", normalizarNomeProprio("J. C. PEREIRA"), "J. C. Pereira");
}

console.log("\n4. normalizarNomeProprio — espaços e entradas vazias");
{
  igual("espaços em volta e no meio são colapsados", normalizarNomeProprio("   João    Pedro  "), "João Pedro");
  igual("vazio -> string vazia", normalizarNomeProprio(""), "");
  igual("só espaços -> string vazia", normalizarNomeProprio("     "), "");
  igual("null -> string vazia", normalizarNomeProprio(null), "");
  igual("undefined -> string vazia", normalizarNomeProprio(undefined), "");
}

console.log("\n5. normalizarNomeProprio — NUNCA descarta informação");
{
  const entrada = "MARIA DA SILVA SANTOS";
  const saida = normalizarNomeProprio(entrada);
  check(
    "mesma quantidade de palavras",
    saida.split(" ").length === entrada.split(" ").length,
    `-> ${saida}`
  );
  check(
    "mesmas letras, ignorando a caixa",
    saida.toLowerCase() === entrada.toLowerCase(),
    `-> ${saida}`
  );
  check(
    "número no nome é preservado",
    normalizarNomeProprio("PLANO 12X ANUAL") === "Plano 12x Anual",
    `-> ${normalizarNomeProprio("PLANO 12X ANUAL")}`
  );
}

console.log("\n6. normalizarEmail");
{
  igual("maiúsculas -> minúsculas", normalizarEmail("JOAO@GMAIL.COM"), "joao@gmail.com");
  igual("espaços em volta são removidos", normalizarEmail("  joao@gmail.com "), "joao@gmail.com");
  igual("vazio -> null", normalizarEmail(""), null);
  igual("null -> null", normalizarEmail(null), null);
  igual("e-mail torto NÃO é recusado", normalizarEmail("ISSO NAO E EMAIL"), "isso nao e email");
}

console.log("\n7. normalizarTelefone");
{
  igual("celular 11 dígitos", normalizarTelefone("11987654321"), "(11) 98765-4321");
  igual("fixo 10 dígitos", normalizarTelefone("1133334444"), "(11) 3333-4444");
  igual("já formatado -> mantém o formato", normalizarTelefone("(11) 98765-4321"), "(11) 98765-4321");
  igual("máscara alternativa é uniformizada", normalizarTelefone("11 98765.4321"), "(11) 98765-4321");
  igual("DDI 55 é removido da exibição", normalizarTelefone("5511987654321"), "(11) 98765-4321");
  igual("vazio -> null", normalizarTelefone(""), null);
  igual("null -> null", normalizarTelefone(null), null);
}

console.log("\n8. normalizarTelefone — número fora do padrão BR é PRESERVADO");
{
  igual("incompleto -> devolve como digitado", normalizarTelefone("9999"), "9999");
  igual("com ramal -> devolve como digitado", normalizarTelefone("(11) 3333-4444 r. 20"), "(11) 3333-4444 r. 20");
  igual("estrangeiro -> devolve como digitado", normalizarTelefone("+1 415 555 0100"), "+1 415 555 0100");
  check(
    "nenhuma entrada não-vazia vira null",
    ["9999", "abc", "+1 415 555 0100", "0"].every((t) => normalizarTelefone(t) !== null)
  );
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
