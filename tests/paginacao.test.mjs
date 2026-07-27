/**
 * Testes dos helpers de paginação/busca da Fase 13 (performance e escala).
 *
 * Roda com: npm run test:paginacao
 * Mesmo esquema dos outros testes do projeto: compila lib/paginacao.ts para
 * .test-build-pag/ e roda com Node puro, sem framework.
 */
import {
  apenasDigitos,
  calcularRange,
  construirFiltroBuscaAlunos,
  sanitizarTermoBusca,
} from "../.test-build-pag/paginacao.js";

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

console.log("\n1. calcularRange — nunca produz página/tamanho inválidos (sem limite silencioso)");
{
  const r1 = calcularRange(1, 20);
  check("página 1, tamanho 20 -> de=0, ate=19", r1.de === 0 && r1.ate === 19, JSON.stringify(r1));

  const r2 = calcularRange(3, 20);
  check("página 3, tamanho 20 -> de=40, ate=59", r2.de === 40 && r2.ate === 59, JSON.stringify(r2));

  const r3 = calcularRange(0, 20);
  check("página 0 -> tratada como página 1 (nunca negativa/zero)", r3.pagina === 1, JSON.stringify(r3));

  const r4 = calcularRange(-5, 20);
  check("página negativa -> tratada como página 1", r4.pagina === 1, JSON.stringify(r4));

  const r5 = calcularRange(1, 100000);
  check(
    "tamanhoPagina absurdo (100000) -> limitado ao teto (100 por padrão)",
    r5.tamanho === 100,
    JSON.stringify(r5)
  );

  const r6 = calcularRange(1, 0);
  check("tamanhoPagina 0 -> vira 1 (nunca range vazio/inválido)", r6.tamanho === 1, JSON.stringify(r6));

  const r7 = calcularRange(2, 10, 500);
  check("tamanhoMax customizado é respeitado", r7.tamanho === 10, JSON.stringify(r7));
}

console.log("\n2. apenasDigitos — normalização de telefone");
{
  check("remove formatação", apenasDigitos("(11) 99999-9999") === "11999999999");
  check("string só com letras -> vazio", apenasDigitos("abc") === "");
  check("já só dígitos -> inalterado", apenasDigitos("11999999999") === "11999999999");
}

console.log("\n3. sanitizarTermoBusca — nunca quebra a sintaxe do .or() do PostgREST");
{
  check("remove vírgula (separador de .or())", !sanitizarTermoBusca("Maria, 11999999999").includes(","));
  check("remove parênteses (agrupamento do .or())", !sanitizarTermoBusca("Maria (aluna)").includes("(") && !sanitizarTermoBusca("Maria (aluna)").includes(")"));
  check("escapa % (coringa do LIKE)", sanitizarTermoBusca("100%").includes("\\%"));
  check("escapa _ (coringa do LIKE)", sanitizarTermoBusca("joao_silva").includes("\\_"));
  check("espaços nas pontas são removidos", sanitizarTermoBusca("  Maria  ") === "Maria");
}

console.log("\n4. construirFiltroBuscaAlunos — monta o .or() com nome + matrícula + telefone");
{
  check("termo vazio -> null (sem filtro nenhum)", construirFiltroBuscaAlunos("") === null);
  check("só espaços -> null", construirFiltroBuscaAlunos("   ") === null);

  const f1 = construirFiltroBuscaAlunos("Maria");
  check("busca por nome cobre nome e matrícula", f1.includes("nome.ilike.%Maria%") && f1.includes("matricula_codigo.ilike.%Maria%"));
  check("busca só com letras não filtra telefone_digitos", !f1.includes("telefone_digitos"));

  const f2 = construirFiltroBuscaAlunos("11999999999");
  check("busca numérica também filtra telefone_digitos", f2.includes("telefone_digitos.ilike.%11999999999%"));
  check("busca numérica cobre nome/matrícula também (podem ter dígitos)", f2.includes("nome.ilike.%11999999999%"));

  const f3 = construirFiltroBuscaAlunos("(11) 99999-9999");
  check(
    "telefone formatado -> filtra por dígitos, não pela formatação",
    f3.includes("telefone_digitos.ilike.%11999999999%") && !f3.includes("(11)")
  );

  const f4 = construirFiltroBuscaAlunos("Maria, Silva");
  const clausulasF4 = f4.split(",");
  check(
    "termo com vírgula vira espaço (não gera cláusula extra nem quebra o .or())",
    clausulasF4.length === 2 && clausulasF4.every((c) => /^\w+\.ilike\.%.*%$/.test(c)),
    f4
  );
  check("a vírgula do termo original não sobra dentro do valor do ilike", !f4.includes("Maria,"));
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
