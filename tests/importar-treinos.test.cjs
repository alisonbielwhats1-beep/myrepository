/**
 * Testes de lib/importar-treinos.ts — parse/validação da planilha de treinos.
 *
 * Roda com: npm run test:importar-treinos
 * Compila para .test-build-import-treinos/ e roda com Node puro.
 */
const {
  analisarPlanilhaTreino,
  analisarLinhasTreino,
} = require("../.test-build-import-treinos/importar-treinos.js");

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

const CAB = "treino;modalidade;objetivo;nivel;publico_alvo;exercicio;series;repeticoes;carga_kg;descanso_segundos;observacoes";

console.log("\n1. Agrupa por treino e faz carry-down do nome");
{
  const csv = [
    CAB,
    "Treino A;Musculação;Hipertrofia;;;Supino;4;10;40;60;desce devagar",
    ";;;;;Crucifixo;3;12;;45;",
    "Treino B;Musculação;;;;Puxada;4;10;;60;",
  ].join("\n");
  const r = analisarPlanilhaTreino(csv);
  check("2 treinos", r.treinos.length === 2, `-> ${r.treinos.length}`);
  const a = r.treinos.find((t) => t.nome_treino === "Treino A");
  const b = r.treinos.find((t) => t.nome_treino === "Treino B");
  check("Treino A tem 2 exercícios (carry-down)", a && a.exercicios.length === 2);
  check("Treino B tem 1 exercício", b && b.exercicios.length === 1);
  check("metadados do treino A vieram da 1ª linha", a && a.modalidade === "Musculação" && a.objetivo === "Hipertrofia");
  check("carga/observações do 1º exercício", a && a.exercicios[0].carga_kg === 40 && a.exercicios[0].observacoes === "desce devagar");
  check("sem erros", r.erros.length === 0, `-> ${JSON.stringify(r.erros)}`);
}

console.log("\n2. Defaults de séries/repetições");
{
  const csv = [CAB, "T;;;;;Agachamento;;;;;"].join("\n");
  const r = analisarPlanilhaTreino(csv);
  const ex = r.treinos[0].exercicios[0];
  check("séries default = 3", ex.series === 3, `-> ${ex.series}`);
  check("repetições default = 12", ex.repeticoes === "12", `-> ${ex.repeticoes}`);
  check("carga default = 0", ex.carga_kg === 0);
  check("descanso vazio -> null", ex.descanso_segundos === null);
}

console.log("\n3. Séries são limitadas (1..20)");
{
  const r = analisarPlanilhaTreino([CAB, "T;;;;;X;99;10;;;"].join("\n"));
  check("séries 99 -> 20", r.treinos[0].exercicios[0].series === 20);
  const r2 = analisarPlanilhaTreino([CAB, "T;;;;;X;0;10;;;"].join("\n"));
  check("séries 0 -> 1", r2.treinos[0].exercicios[0].series === 1);
}

console.log("\n4. Linha em branco é ignorada; linha com conteúdo sem exercício é erro");
{
  // Linha 100% em branco: ignorada (sem erro).
  const r0 = analisarPlanilhaTreino([CAB, "T;;;;;Supino;3;10;;;", ";;;;;;;;;;"].join("\n"));
  check("linha 100% vazia é ignorada (0 erros)", r0.erros.length === 0, `-> ${JSON.stringify(r0.erros)}`);
  check("treino T entra com 1 exercício", r0.treinos.length === 1 && r0.treinos[0].exercicios.length === 1);

  // Linha com algum conteúdo (descanso) mas SEM exercício (treino herdado) → erro.
  const r1 = analisarPlanilhaTreino([CAB, "T;;;;;Supino;3;10;;;", ";;;;;;;;;30;"].join("\n"));
  check("linha com conteúdo sem exercício vira erro", r1.erros.some((e) => /exerc/i.test(e.motivo)));
}

console.log("\n5. Cabeçalho sem coluna obrigatória");
{
  const r = analisarPlanilhaTreino(["nome;series;repeticoes", "X;3;10"].join("\n"));
  check("falta 'treino'/'exercicio' -> erro", r.treinos.length === 0 && r.erros.length > 0);
}

console.log("\n6. Planilha vazia");
{
  const r = analisarLinhasTreino([]);
  check("vazia -> erro, 0 treinos", r.treinos.length === 0 && r.erros.length === 1);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
