/**
 * Testes de lib/faixas-comerciais.ts (faixas comerciais internas — migration 056).
 *
 * Roda com: npm run test:faixas
 * Mesmo esquema dos outros testes do projeto: compila lib/faixas-comerciais.ts +
 * lib/types.ts para .test-build-faixas/ e roda com Node puro, sem framework.
 */
import {
  faixaSugerida,
  rotuloFaixaSugerida,
  intervaloLabel,
  validarFaixa,
  MENSAGEM_ACIMA_DA_TABELA,
} from "../.test-build-faixas/faixas-comerciais.js";

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

/** Fabrica uma faixa com os defaults da migration 056. */
function faixa(parcial) {
  return {
    id: parcial.nome.toLowerCase(),
    nome: parcial.nome,
    alunos_min: parcial.alunos_min,
    alunos_max: parcial.alunos_max,
    preco_mensal: parcial.preco_mensal ?? 0,
    ativo: parcial.ativo ?? true,
    publico: false,
    disponivel_novos_clientes: true,
    ordem: parcial.ordem ?? 0,
    descricao_interna: null,
    observacoes_comerciais: null,
    criado_em: "2026-01-01T00:00:00Z",
    atualizado_em: "2026-01-01T00:00:00Z",
  };
}

// As três faixas cadastradas pelo seed da migration 056.
const SEED = [
  faixa({ nome: "Start", alunos_min: 0, alunos_max: 200, preco_mensal: 99.9, ordem: 1 }),
  faixa({ nome: "Growth", alunos_min: 201, alunos_max: 350, preco_mensal: 159, ordem: 2 }),
  faixa({ nome: "Pro", alunos_min: 351, alunos_max: 500, preco_mensal: 229, ordem: 3 }),
];

const nomeDe = (f) => (f ? f.nome : null);

console.log("\n1. Limites exatos de cada faixa");
{
  check("0 aluno -> Start", nomeDe(faixaSugerida(0, SEED)) === "Start");
  check("1 aluno -> Start", nomeDe(faixaSugerida(1, SEED)) === "Start");
  check("200 alunos -> Start (topo da faixa)", nomeDe(faixaSugerida(200, SEED)) === "Start");
  check("201 alunos -> Growth (início da faixa)", nomeDe(faixaSugerida(201, SEED)) === "Growth");
  check("350 alunos -> Growth (topo da faixa)", nomeDe(faixaSugerida(350, SEED)) === "Growth");
  check("351 alunos -> Pro (início da faixa)", nomeDe(faixaSugerida(351, SEED)) === "Pro");
  check("500 alunos -> Pro (topo da tabela)", nomeDe(faixaSugerida(500, SEED)) === "Pro");
}

console.log("\n2. Acima da tabela não vira plano fixo");
{
  check("501 alunos -> null", faixaSugerida(501, SEED) === null);
  check("5000 alunos -> null", faixaSugerida(5000, SEED) === null);
  check(
    "rótulo acima da tabela é avaliação personalizada",
    rotuloFaixaSugerida(501, SEED) === MENSAGEM_ACIMA_DA_TABELA
  );
  check(
    "mensagem não cita Enterprise/Scale nem preço",
    !/enterprise|scale|R\$/i.test(MENSAGEM_ACIMA_DA_TABELA)
  );
}

console.log("\n3. Faixa desativada é ignorada");
{
  const semGrowth = SEED.map((f) =>
    f.nome === "Growth" ? { ...f, ativo: false } : f
  );
  check("300 alunos com Growth ativa -> Growth", nomeDe(faixaSugerida(300, SEED)) === "Growth");
  check("300 alunos com Growth inativa -> null", faixaSugerida(300, semGrowth) === null);
  check(
    "desativar Growth não afeta as vizinhas",
    nomeDe(faixaSugerida(100, semGrowth)) === "Start" &&
      nomeDe(faixaSugerida(400, semGrowth)) === "Pro"
  );
}

console.log("\n4. Entradas degeneradas não explodem");
{
  check("lista vazia -> null", faixaSugerida(150, []) === null);
  check("todas inativas -> null", faixaSugerida(150, SEED.map((f) => ({ ...f, ativo: false }))) === null);
  check("quantidade negativa -> null", faixaSugerida(-1, SEED) === null);
  check("NaN -> null", faixaSugerida(Number.NaN, SEED) === null);
  check("lista vazia usa a mensagem de avaliação personalizada", rotuloFaixaSugerida(150, []) === MENSAGEM_ACIMA_DA_TABELA);
}

console.log("\n5. Ordem de exibição decide o empate, não a posição no array");
{
  const invertida = [SEED[2], SEED[1], SEED[0]];
  check(
    "array fora de ordem ainda resolve 250 -> Growth",
    nomeDe(faixaSugerida(250, invertida)) === "Growth"
  );
  const sobrepostas = [
    faixa({ nome: "Ampla", alunos_min: 0, alunos_max: 1000, ordem: 9 }),
    faixa({ nome: "Estreita", alunos_min: 0, alunos_max: 200, ordem: 1 }),
  ];
  check(
    "com intervalos sobrepostos vence a menor ordem",
    nomeDe(faixaSugerida(150, sobrepostas)) === "Estreita"
  );
}

console.log("\n6. Faixa sem teto");
{
  const comTeto = [
    SEED[0],
    faixa({ nome: "Sob medida", alunos_min: 201, alunos_max: null, ordem: 2 }),
  ];
  check("faixa sem teto cobre 10000", nomeDe(faixaSugerida(10000, comTeto)) === "Sob medida");
  check(
    "rótulo de faixa sem teto",
    intervaloLabel({ alunos_min: 501, alunos_max: null }) === "Acima de 500 alunos"
  );
}

console.log("\n7. Rótulos de intervalo");
{
  check("Start", intervaloLabel({ alunos_min: 0, alunos_max: 200 }) === "Até 200 alunos");
  check("Growth", intervaloLabel({ alunos_min: 201, alunos_max: 350 }) === "De 201 a 350 alunos");
  check("Pro", intervaloLabel({ alunos_min: 351, alunos_max: 500 }) === "De 351 a 500 alunos");
  check("rótulo do texto sugerido", rotuloFaixaSugerida(250, SEED) === "Faixa comercial sugerida: Growth");
}

console.log("\n8. Validação no servidor");
{
  const valida = { nome: "Start", alunos_min: 0, alunos_max: 200, preco_mensal: 99.9, ordem: 1 };
  check("entrada válida passa", validarFaixa(valida) === null);
  check("sem teto é válido", validarFaixa({ ...valida, alunos_max: null }) === null);
  check("nome vazio é recusado", validarFaixa({ ...valida, nome: "   " }) !== null);
  check("máximo menor que mínimo é recusado", validarFaixa({ ...valida, alunos_min: 300, alunos_max: 200 }) !== null);
  check("mínimo negativo é recusado", validarFaixa({ ...valida, alunos_min: -1 }) !== null);
  check("preço negativo é recusado", validarFaixa({ ...valida, preco_mensal: -0.01 }) !== null);
  check("preço zero é aceito (cortesia/parceria)", validarFaixa({ ...valida, preco_mensal: 0 }) === null);
  check("mínimo fracionado é recusado", validarFaixa({ ...valida, alunos_min: 1.5 }) !== null);
  check("ordem negativa é recusada", validarFaixa({ ...valida, ordem: -1 }) !== null);
  check("preço NaN é recusado", validarFaixa({ ...valida, preco_mensal: Number.NaN }) !== null);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
