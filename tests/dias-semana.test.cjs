/**
 * Testes de lib/dias-semana.ts — normalização/rotulagem dos dias de treino
 * (migration 083) e o cálculo do dia atual no fuso da academia.
 *
 * Roda com: npm run test:dias
 * Mesmo esquema do test:aluno: compila para CommonJS em .test-build-dias/ e
 * roda com Node puro (require), sem framework.
 */
const {
  normalizarDias,
  resumoDias,
  treinoAplicaNoDia,
  diaSemanaHojeSaoPaulo,
  ROTULO_DIA_CURTO,
} = require("../.test-build-dias/dias-semana.js");

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

console.log("\n1. normalizarDias: só 1..7, sem repetição, ordenado");
{
  check("ordena e deduplica", JSON.stringify(normalizarDias([3, 1, 3, 2])) === "[1,2,3]");
  check("descarta fora de 1..7", JSON.stringify(normalizarDias([0, 8, 5, -1, 7])) === "[5,7]");
  check("descarta não-inteiros/strings inválidas", JSON.stringify(normalizarDias([2.5, "x", null, 4])) === "[4]");
  check("aceita string numérica", JSON.stringify(normalizarDias(["1", "2"])) === "[1,2]");
  check("não-array vira vazio", JSON.stringify(normalizarDias(null)) === "[]");
  check("vazio continua vazio", JSON.stringify(normalizarDias([])) === "[]");
}

console.log("\n2. resumoDias: rótulo textual");
{
  check("vazio -> 'Sem dia definido'", resumoDias([]) === "Sem dia definido");
  check("todos os 7 -> 'Todos os dias'", resumoDias([1, 2, 3, 4, 5, 6, 7]) === "Todos os dias");
  check("subconjunto -> curtos por ·", resumoDias([1, 3, 5]) === "SEG · QUA · SEX");
  check("desordenado é normalizado no resumo", resumoDias([5, 1, 3]) === "SEG · QUA · SEX");
}

console.log("\n3. treinoAplicaNoDia");
{
  check("aplica quando inclui o dia", treinoAplicaNoDia([1, 3, 5], 3) === true);
  check("não aplica quando não inclui", treinoAplicaNoDia([1, 3, 5], 2) === false);
  check("ficha sem dia não aplica a nenhum dia específico", treinoAplicaNoDia([], 4) === false);
}

console.log("\n4. diaSemanaHojeSaoPaulo: dia ISO no fuso da academia");
{
  // 2026-08-17 é uma segunda-feira. 12:00Z = 09:00 em SP (UTC-3), ainda segunda.
  check(
    "2026-08-17T12:00Z -> segunda (1)",
    diaSemanaHojeSaoPaulo(new Date("2026-08-17T12:00:00Z")) === 1
  );
  // 2026-08-17T02:00Z = 2026-08-16 23:00 em SP: ainda domingo (7).
  check(
    "2026-08-17T02:00Z -> domingo (7) no fuso SP",
    diaSemanaHojeSaoPaulo(new Date("2026-08-17T02:00:00Z")) === 7
  );
  check("rótulo de domingo é DOM", ROTULO_DIA_CURTO[7] === "DOM");
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
if (falhou > 0) process.exit(1);
