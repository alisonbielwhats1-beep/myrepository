/**
 * Testes de lib/treinos.ts — classificação de nível/origem dos treinos-modelo
 * após a desconflação origem × visibilidade (migration 076).
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

console.log("\n1. origem_tipo é a fonte de verdade (dados migrados)");
{
  check(
    "gestacad -> plataforma (mesmo com academia_id preenchido)",
    nivelDoTreino({ origem_tipo: "gestacad", academia_id: null, visibilidade: "plataforma" }) === "plataforma"
  );
  check(
    "instrutor + visibilidade instrutor -> instrutor (privado)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "instrutor" }) === "instrutor"
  );
  // Chave da desconflação: a AUTORIA continua instrutor, mas compartilhar com a
  // equipe (visibilidade) move o card para a aba "Da academia".
  check(
    "instrutor + visibilidade academia -> academia (autoria não muda a aba)",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
  check(
    "academia (ficha) + visibilidade academia -> academia",
    nivelDoTreino({ origem_tipo: "academia", academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
}

console.log("\n2. Fallback pré-migração (sem origem_tipo) reproduz a regra antiga");
{
  check(
    "academia_id nulo -> plataforma",
    nivelDoTreino({ origem_tipo: undefined, academia_id: null, visibilidade: "academia" }) === "plataforma"
  );
  check(
    "visibilidade plataforma -> plataforma",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "plataforma" }) === "plataforma"
  );
  check(
    "academia_id + instrutor -> instrutor",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "instrutor" }) === "instrutor"
  );
  check(
    "academia_id + academia -> academia",
    nivelDoTreino({ origem_tipo: undefined, academia_id: ACAD, visibilidade: "academia" }) === "academia"
  );
}

console.log("\n3. origem_tipo tem precedência sobre o fallback para 'plataforma'");
{
  // Uma linha de tenant com origem_tipo='instrutor' nunca cai como plataforma,
  // mesmo que a visibilidade legada ainda diga 'plataforma' por engano — a
  // origem manda, e sem visibilidade 'instrutor' o nível resolve para academia.
  check(
    "origem_tipo instrutor impede plataforma falsa da visibilidade legada",
    nivelDoTreino({ origem_tipo: "instrutor", academia_id: ACAD, visibilidade: "plataforma" }) === "academia"
  );
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
