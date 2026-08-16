/**
 * Testes de lib/treinos.ts — classificação de nível dos treinos-modelo depois
 * da desconflação origem × visibilidade (migrations 076 e 077).
 *
 * Roda com: npm run test:treinos
 * Mesmo esquema dos outros testes do projeto: compila lib/treinos.ts +
 * lib/types.ts para .test-build-treinos/ e roda com Node puro, sem framework.
 */
import { nivelDoTreino } from "../.test-build-treinos/treinos.js";

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

const ACAD = "11111111-1111-1111-1111-111111111111";

console.log("\n1. Dados migrados: origem_tipo define plataforma; visibilidade define o nível de tenant");
{
  check(
    "gestacad -> plataforma (mesmo com academia_id preenchido)",
    nivelDoTreino({ origem_tipo: "gestacad", academia_id: null, visibilidade: "academia" }) === "plataforma"
  );
  check(
    "instrutor + privado -> privado",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "privado" }) === "privado"
  );
  check(
    "instrutor + equipe -> equipe (nível NOVO, distinto de academia)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "equipe" }) === "equipe"
  );
  // Chave da desconflação: a AUTORIA continua instrutor, mas compartilhar
  // (visibilidade) é que move o card de aba.
  check(
    "instrutor + academia -> academia (autoria não muda a aba)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
  check(
    "academia (ficha) + academia -> academia",
    nivelDoTreino({ origem_tipo: "academia", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
}

console.log("\n2. equipe e academia são níveis DISTINTOS");
{
  const equipe = nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "equipe" });
  const academia = nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" });
  check("equipe !== academia", equipe !== academia);
  check("equipe é 'equipe'", equipe === "equipe");
  check("academia é 'academia'", academia === "academia");
}

console.log("\n3. Fallback pré-migração (sem origem_tipo, valores legados)");
{
  check(
    "academia_id nulo -> plataforma",
    nivelDoTreino({ origem_tipo: undefined, academia_id: null, visibilidade: "academia" }) === "plataforma"
  );
  check(
    "visibilidade legada 'plataforma' -> plataforma",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "plataforma" }) === "plataforma"
  );
  check(
    "visibilidade legada 'instrutor' -> privado",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "instrutor" }) === "privado"
  );
  check(
    "visibilidade 'academia' -> academia",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
}

console.log("\n4. origem_tipo tem precedência: não classifica plataforma falsa");
{
  check(
    "origem_tipo instrutor + visibilidade legada 'plataforma' -> academia (não plataforma)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
  check(
    "gestacad vence visibilidade privado -> plataforma",
    nivelDoTreino({ origem_tipo: "gestacad", academia_id: null, visibilidade: "privado" }) === "plataforma"
  );
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
