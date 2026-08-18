/**
 * Testes de `lib/periodo.ts` — janela de datas do Dashboard e do Financeiro.
 *
 * Roda com: npm run test:periodo
 *
 * POR QUE ESTE TESTE EXISTE
 *   O Dashboard contava "novos alunos" comparando `criado_em` (timestamptz)
 *   contra limites de meia-noite em UTC (`${data}T00:00:00Z`), mas as datas
 *   vêm de `hojeSaoPaulo()` — a data-calendário em América/São_Paulo
 *   (UTC-3). Um aluno cadastrado entre ~21h e 23h59 em SP cai no dia UTC
 *   seguinte e era contado no dia errado. `inicioDiaSaoPauloUTC` (lib/utils.ts)
 *   corrige isso convertendo a data-calendário de SP para o instante UTC
 *   correto da meia-noite de SP.
 *
 *   Escopo deliberadamente pequeno (4 cenários, não uma suíte completa de
 *   `resolverPeriodo`/`resolverJanelaDashboard`/`deslocar` — ver Plano 002):
 *   1. conversão início-do-dia SP → UTC; 2. virada de dia; 3. virada de
 *   mês/ano; 4. um cenário representativo de janela do Dashboard.
 *
 *   O runner reexecuta este arquivo em TZ=UTC, TZ=Asia/Tokyo e
 *   TZ=America/Sao_Paulo: se alguma comparação voltar a depender do fuso do
 *   processo, as asserções quebram.
 */
import { resolverJanelaDashboard } from "../.test-build-periodo/periodo.js";
import {
  hojeSaoPaulo,
  somarDiasISO,
  inicioDiaSaoPauloUTC,
} from "../.test-build-periodo/utils.js";

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
function eq(nome, obtido, esperado) {
  check(nome, obtido === esperado, `→ esperado "${esperado}", obtido "${obtido}"`);
}

const TZ = process.env.TZ ?? "(padrão)";
console.log(`\n=== Fuso do processo: ${TZ} ===`);

// ---------------------------------------------------------------------------
// 1. Conversão de início do dia São Paulo → UTC
// ---------------------------------------------------------------------------
eq(
  "inicioDiaSaoPauloUTC: meia-noite de SP é 03:00 UTC (fuso fixo -03:00)",
  inicioDiaSaoPauloUTC("2026-08-16"),
  "2026-08-16T03:00:00.000Z"
);

// ---------------------------------------------------------------------------
// 2. Virada de dia — o caso que corrige CORRECTNESS-01
// ---------------------------------------------------------------------------
// Aluno criado às 23:30 em SP no dia 16/08 = 02:30 UTC do dia 17/08.
const CRIADO_EM_23H30_SP = "2026-08-17T02:30:00.000Z";
const inicioDia16 = inicioDiaSaoPauloUTC("2026-08-16");
const inicioDia17 = inicioDiaSaoPauloUTC("2026-08-17");
check(
  "23:30 SP do dia 16 cai DENTRO da janela SP-anchored do dia 16",
  CRIADO_EM_23H30_SP >= inicioDia16 && CRIADO_EM_23H30_SP < inicioDia17,
  `→ ${CRIADO_EM_23H30_SP} não está em [${inicioDia16}, ${inicioDia17})`
);
check(
  "23:30 SP do dia 16 cai FORA da janela antiga (UTC-literal) do dia 16 — bug original",
  !(CRIADO_EM_23H30_SP >= "2026-08-16T00:00:00.000Z" && CRIADO_EM_23H30_SP < "2026-08-17T00:00:00.000Z"),
  `→ ${CRIADO_EM_23H30_SP} estava (incorretamente) fora da janela UTC-literal antes da correção`
);

// ---------------------------------------------------------------------------
// 3. Virada de mês/ano
// ---------------------------------------------------------------------------
eq("somarDiasISO atravessa o ano", somarDiasISO("2026-12-31", 1), "2027-01-01");
check(
  "inicioDiaSaoPauloUTC(2026-12-31) ainda é meia-noite de SP (T03:00)",
  inicioDiaSaoPauloUTC("2026-12-31").endsWith("T03:00:00.000Z"),
  `→ ${inicioDiaSaoPauloUTC("2026-12-31")}`
);
check(
  "inicioDiaSaoPauloUTC(2027-01-01) ainda é meia-noite de SP (T03:00)",
  inicioDiaSaoPauloUTC("2027-01-01").endsWith("T03:00:00.000Z"),
  `→ ${inicioDiaSaoPauloUTC("2027-01-01")}`
);

// ---------------------------------------------------------------------------
// 4. Cenário representativo do Dashboard — resolverJanelaDashboard composto
//    com a mesma conversão que getContagemAlunosCriadosEntre agora usa.
// ---------------------------------------------------------------------------
const hoje = hojeSaoPaulo();
const janela = resolverJanelaDashboard({ range: "hoje" });
eq("resolverJanelaDashboard('hoje'): desde === ate", janela.desde, janela.ate);
eq(
  "resolverJanelaDashboard('hoje') é ancorado em hojeSaoPaulo(), não no fuso do processo",
  janela.desde,
  hoje
);
const diaSeguinteJanela = somarDiasISO(janela.ate, 1);
check(
  "limite inferior da janela do Dashboard é meia-noite de SP (T03:00)",
  inicioDiaSaoPauloUTC(janela.desde).endsWith("T03:00:00.000Z"),
  `→ ${inicioDiaSaoPauloUTC(janela.desde)}`
);
check(
  "limite superior (exclusivo) da janela do Dashboard é meia-noite de SP (T03:00)",
  inicioDiaSaoPauloUTC(diaSeguinteJanela).endsWith("T03:00:00.000Z"),
  `→ ${inicioDiaSaoPauloUTC(diaSeguinteJanela)}`
);

console.log(`\n=== ${passou} passaram, ${falhou} falharam (TZ=${TZ}) ===`);
if (falhou > 0) process.exit(1);
