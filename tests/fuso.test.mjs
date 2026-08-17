/**
 * Testes de fuso horário — todo horário exibido é o de São Paulo.
 *
 * Roda com: npm run test:fuso
 *
 * POR QUE ESTE TESTE EXISTE
 *   Um acesso liberado às 13h35 em São Paulo aparecia como 16h35 no app do
 *   aluno: `toLocaleString` sem `timeZone` usa o fuso do PROCESSO, e em produção
 *   (Vercel) o processo roda em UTC. O bug não aparecia no desenvolvimento com a
 *   máquina em horário de Brasília — por isso o teste força fusos diferentes.
 *
 *   O runner reexecuta este arquivo em TZ=UTC e TZ=Asia/Tokyo: se alguma
 *   formatação voltar a depender do fuso do processo, as asserções quebram.
 */
import {
  anoSaoPaulo,
  dataSaoPaulo,
  diaDoMesSaoPaulo,
  formatDataDeInstante,
  formatDataHora,
  formatDataHoraCompleta,
  formatDataISO,
  formatHora,
  hojeSaoPaulo,
  horaSaoPaulo,
  mesSaoPaulo,
  somarDiasISO,
} from "../.test-build-fuso/utils.js";

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
// 1. O bug relatado: acesso liberado 13h35 em SP (= 16h35 UTC).
// ---------------------------------------------------------------------------
const ACESSO = "2026-08-17T16:35:00.000Z";
eq("formatDataHora mostra 13:35 (não 16:35 do UTC)", formatDataHora(ACESSO), "17/08, 13:35");
eq("formatHora mostra 13:35", formatHora(ACESSO), "13:35");
eq("formatDataHoraCompleta", formatDataHoraCompleta(ACESSO), "17/08/2026, 13:35");
eq("formatDataDeInstante", formatDataDeInstante(ACESSO), "17/08/2026");

// ---------------------------------------------------------------------------
// 2. Virada do dia: 23h30 em SP é 02h30 UTC do dia SEGUINTE. A data exibida
//    tem de continuar sendo a do dia em São Paulo.
// ---------------------------------------------------------------------------
const NOITE = "2026-08-18T02:30:00.000Z"; // 17/08 23:30 em SP
eq("23h30 SP continua no dia 17", formatDataHora(NOITE), "17/08, 23:30");
eq("data-calendário SP da virada", dataSaoPaulo(NOITE), "2026-08-17");
eq("hora SP da virada", String(horaSaoPaulo(NOITE)), "23");
eq("data completa da virada", formatDataDeInstante(NOITE), "17/08/2026");

// Meia-noite e meia em SP (03h30 UTC) já é o dia seguinte.
const MADRUGADA = "2026-08-18T03:30:00.000Z";
eq("00h30 SP já é dia 18", formatDataHora(MADRUGADA), "18/08, 00:30");
eq("data-calendário 00h30", dataSaoPaulo(MADRUGADA), "2026-08-18");

// ---------------------------------------------------------------------------
// 3. Coluna `date` (YYYY-MM-DD) nunca vira Date — imune a fuso.
// ---------------------------------------------------------------------------
eq("formatDataISO simples", formatDataISO("2026-08-17"), "17/08/2026");
eq("formatDataISO com timestamp", formatDataISO("2026-01-05T00:00:00Z"), "05/01/2026");
eq("formatDataISO 1º de janeiro", formatDataISO("2026-01-01"), "01/01/2026");

// ---------------------------------------------------------------------------
// 4. "Hoje" e seus componentes são sempre o dia de São Paulo, e coerentes
//    entre si (o bug clássico era dia/mês/ano vindos de fusos diferentes).
// ---------------------------------------------------------------------------
const hoje = hojeSaoPaulo();
check("hojeSaoPaulo tem formato YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(hoje), hoje);
eq("hojeSaoPaulo === dataSaoPaulo(agora)", hoje, dataSaoPaulo(new Date()));
const [aH, mH, dH] = hoje.split("-").map(Number);
eq("anoSaoPaulo coerente com hojeSaoPaulo", String(anoSaoPaulo()), String(aH));
eq("mesSaoPaulo é 0-indexado (igual getMonth)", String(mesSaoPaulo()), String(mH - 1));
eq("diaDoMesSaoPaulo coerente", String(diaDoMesSaoPaulo()), String(dH));

// ---------------------------------------------------------------------------
// 5. somarDiasISO — aritmética de data-calendário, sem deslize de fuso.
// ---------------------------------------------------------------------------
eq("somarDiasISO +1", somarDiasISO("2026-08-17", 1), "2026-08-18");
eq("somarDiasISO -30", somarDiasISO("2026-08-17", -30), "2026-07-18");
eq("somarDiasISO atravessa o ano", somarDiasISO("2026-12-31", 1), "2027-01-01");
eq("somarDiasISO ano bissexto", somarDiasISO("2024-02-28", 1), "2024-02-29");
eq("somarDiasISO 0 é identidade", somarDiasISO("2026-08-17", 0), "2026-08-17");
// Régua de 7 dias do dashboard: o último ponto é sempre hoje em SP.
eq("régua de 7 dias termina hoje", somarDiasISO(hoje, 0), hoje);

console.log(`\n=== ${passou} passaram, ${falhou} falharam (TZ=${TZ}) ===`);
if (falhou > 0) process.exit(1);
