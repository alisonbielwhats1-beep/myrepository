// Testes da importação de alunos (parser + validação). Puro, sem framework.
// Roda com: npm run test:importar
// CommonJS (.cjs) porque importar-alunos.ts tem import de VALOR (normalizarCpf
// de validacoes) — o mesmo esquema de test:aluno/test:financeiro.
const {
  parsearCsv,
  analisarPlanilha,
  analisarLinhas,
  gerarModeloXlsx,
  gerarModeloCsv,
  CABECALHO_MODELO,
} = require("../.test-build-import/importar-alunos.js");
const { gerarXlsx, lerXlsx, ehXlsx } = require("../.test-build-import/xlsx-minimo.js");

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

const PLANOS = [
  { id: "p1", nome: "Mensal" },
  { id: "p2", nome: "Plano Trimestral" },
];
const CAB = "nome,cpf,telefone,email,plano,dia_vencimento,status";
const analisar = (linhasCsv) => analisarPlanilha([CAB, ...linhasCsv].join("\n"), PLANOS);

console.log("\n1. parsearCsv");
{
  check("vírgula separa campos", JSON.stringify(parsearCsv("a,b,c")) === JSON.stringify([["a", "b", "c"]]));
  check(
    "detecta ponto-e-vírgula (Excel BR)",
    JSON.stringify(parsearCsv("a;b;c")) === JSON.stringify([["a", "b", "c"]])
  );
  check(
    "aspas protegem o separador dentro do campo",
    JSON.stringify(parsearCsv('nome,obs\n"Silva, Jr",ok')) ===
      JSON.stringify([["nome", "obs"], ["Silva, Jr", "ok"]])
  );
  check('aspas duplas "" viram uma aspa', JSON.stringify(parsearCsv('"a""b"')) === JSON.stringify([['a"b']]));
  check("CRLF é tratado como quebra de linha", parsearCsv("a\r\nb").length === 2);
  check("BOM no início é ignorado", parsearCsv("﻿a,b")[0][0] === "a");
}

console.log("\n2. Linha válida e mapeamento de plano");
{
  const r = analisar(["João Silva,12345678901,11999998888,joao@x.com,Mensal,10,ativa"]);
  check("1 válido, 0 erro", r.validos.length === 1 && r.erros.length === 0, JSON.stringify(r.erros));
  const a = r.validos[0];
  check("cpf normalizado (só dígitos)", a.cpf === "12345678901");
  check("plano casado por nome -> id", a.plano_id === "p1");
  check("dia_vencimento lido", a.dia_vencimento === 10);
  check("status ativa", a.status_matricula === "ativa");
  check("linha correta (2)", a.linha === 2);
}

console.log("\n3. Erros que impedem a linha");
{
  check("nome vazio -> erro", analisar([",12345678901,,,,,"]).erros.length === 1);
  check("cpf inválido -> erro", analisar(["Ana,123,,,,,"]).erros[0].motivo.includes("CPF"));
  check("plano inexistente -> erro", analisar(["Ana,,,,Ouro,,"]).erros[0].motivo.includes("Ouro"));
  check(
    "telefone torto -> erro (número errado é pior que vazio)",
    analisar(["Ana,,123,,,,"]).erros[0].motivo.includes("Telefone")
  );
  check("dia fora de 1-28 -> erro", analisar(["Ana,,,,,45,"]).erros[0].motivo.includes("vencimento"));
  check("status inválido -> erro", analisar(["Ana,,,,,,vip"]).erros[0].motivo.includes("Status"));
  check(
    "cpf repetido na planilha -> erro na 2a",
    (() => {
      const r = analisar(["A,11122233344,,,,,", "B,11122233344,,,,,"]);
      return r.validos.length === 1 && r.erros.length === 1 && r.erros[0].linha === 3;
    })()
  );
}

console.log("\n4. Telefone e e-mail (opção 1: não bloqueia, avisa)");
{
  const semFone = analisar(["Ana,,,,,,"]);
  check("sem telefone -> válido + aviso", semFone.validos.length === 1 && semFone.avisos.length === 1);
  check("aviso menciona WhatsApp", semFone.avisos[0].motivo.includes("WhatsApp"));

  const emailTorto = analisar(["Ana,,11999998888,naoehemail,,,"]);
  check("e-mail inválido -> aviso, não bloqueia", emailTorto.validos.length === 1 && emailTorto.avisos.length === 1);
  check("e-mail inválido é descartado (null)", emailTorto.validos[0].email === null);
}

console.log("\n5. Status derivado e regra 'sem plano nunca ativa'");
{
  check(
    "status em branco + plano -> ativa",
    analisar(["Ana,,11999998888,,Mensal,,"]).validos[0].status_matricula === "ativa"
  );
  check(
    "status em branco sem plano -> pendente",
    analisar(["Ana,,11999998888,,,,"]).validos[0].status_matricula === "pendente"
  );
  check(
    "status 'ativa' sem plano -> forçado pendente",
    analisar(["Ana,,11999998888,,,,ativa"]).validos[0].status_matricula === "pendente"
  );
  check(
    "dia e telefone em branco -> null (servidor aplica padrão)",
    analisar(["Ana,,,,,,"]).validos[0].dia_vencimento === null
  );
}

console.log("\n6. Cabeçalho tolerante e vazios");
{
  const comAlias = analisarPlanilha("nome;celular;plano\nAna;11999998888;Plano Trimestral", PLANOS);
  check("separador ; + alias 'celular' -> telefone", comAlias.validos[0].telefone === "11999998888");
  check("alias de plano com espaço casa", comAlias.validos[0].plano_id === "p2");

  check("linha totalmente vazia é ignorada", analisar(["", "Ana,,11999998888,,,,"]).validos.length === 1);
  check(
    "falta coluna nome -> erro global",
    analisarPlanilha("cpf,telefone\n123,456", PLANOS).erros[0].motivo.includes("nome")
  );
  check("planilha vazia -> erro", analisarPlanilha("", PLANOS).erros.length === 1);
}

// A leitura de .xlsx é assíncrona (descompressão), então esta parte roda em
// uma função async e o resumo final vai junto.
(async () => {
  console.log("\n7. Planilha .xlsx (ida e volta)");
  {
    const bytes = gerarXlsx(["nome", "cpf"], [["Ana", "01234567890"]]);
    check("gerarXlsx produz um ZIP (assinatura PK)", ehXlsx(bytes));
    check("CSV não é confundido com xlsx", !ehXlsx(new TextEncoder().encode("nome,cpf")));

    const grade = await lerXlsx(bytes);
    check("lê o cabeçalho de volta", JSON.stringify(grade[0]) === JSON.stringify(["nome", "cpf"]));
    check("lê a linha de dados de volta", JSON.stringify(grade[1]) === JSON.stringify(["Ana", "01234567890"]));
    check(
      "zero à esquerda do CPF sobrevive (coluna é texto)",
      grade[1][1] === "01234567890"
    );

    const acentos = await lerXlsx(gerarXlsx(["nome"], [["João <Ré> & Cia \"X\""]]));
    check("acentos e caracteres de XML voltam intactos", acentos[1][0] === 'João <Ré> & Cia "X"');

    const modelo = await lerXlsx(gerarModeloXlsx());
    check(
      "modelo .xlsx traz o cabeçalho oficial",
      JSON.stringify(modelo[0]) === JSON.stringify(CABECALHO_MODELO)
    );
    const doModelo = analisarLinhas(modelo, PLANOS);
    check("linha de exemplo do modelo é válida", doModelo.validos.length >= 1);
    check("exemplo do modelo casa o plano Mensal", doModelo.validos[0].plano_id === "p1");

    // O modelo CSV precisa usar ';' — com ',' o Excel pt-BR joga tudo numa coluna.
    const csv = gerarModeloCsv();
    check("modelo CSV usa ponto-e-vírgula", csv.includes("nome;cpf;telefone"));
    check("modelo CSV começa com BOM (acentos no Excel)", csv.charCodeAt(0) === 0xfeff);
    check(
      "modelo CSV é lido de volta com as mesmas colunas",
      JSON.stringify(parsearCsv(csv)[0]) === JSON.stringify(CABECALHO_MODELO)
    );
  }

  console.log("\n8. Numeração de linha bate com a da planilha");
  {
    // Linha 2 vazia: o erro da Ana tem que apontar a linha 3, não a 2.
    const grade = [["nome"], [], ["  "], ["Ana"], [""]];
    const r = analisarLinhas(grade, PLANOS);
    check("linha em branco no meio não desloca a numeração", r.validos[0].linha === 4, JSON.stringify(r.validos));

    const comErro = analisarLinhas([["nome", "cpf"], [], ["Bia", "123"]], PLANOS);
    check("erro aponta o número real da linha", comErro.erros[0].linha === 3, JSON.stringify(comErro.erros));
  }

  console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
  process.exit(falhou > 0 ? 1 : 0);
})();
