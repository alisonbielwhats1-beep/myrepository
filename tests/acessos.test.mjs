/**
 * Testes de decidirAcesso e statusLiberacaoDe (Fase 8 — Recepção).
 *
 * Roda com: npm run test:acessos
 * Mesmo esquema dos outros testes do projeto: compila lib/utils.ts +
 * lib/types.ts para .test-build/ e roda com Node puro, sem framework.
 */
import { decidirAcesso, statusLiberacaoDe, hojeSaoPaulo } from "../.test-build/utils.js";

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

const hoje = hojeSaoPaulo();
function haDias(n) {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const mensalidade = (overrides) => ({
  id: "m1",
  competencia: "2026-07",
  data: haDias(5),
  valor: 150,
  status: "pendente",
  ...overrides,
});

console.log("\n1. Matrícula não ativa bloqueia antes de olhar o financeiro");
{
  for (const status of ["trancada", "inativa", "pendente", "cancelada"]) {
    const r = decidirAcesso(status, "liberar", [mensalidade({ data: haDias(5) })]);
    check(`${status} -> bloqueado`, r.resultado === "bloqueado", `-> ${r.resultado}`);
    check(`${status} -> politicaAplicada null (nem olhou financeiro)`, r.politicaAplicada === null);
    check(`${status} -> quantidadeVencida 0`, r.quantidadeVencida === 0);
  }
}

console.log("\n2. Ativa sem mensalidade vencida -> liberado");
{
  const semNada = decidirAcesso("ativa", "bloquear", []);
  check("sem mensalidades -> liberado mesmo com política bloquear", semNada.resultado === "liberado");

  const futura = decidirAcesso("ativa", "bloquear", [mensalidade({ data: haDias(-5) })]);
  check("mensalidade futura (vence daqui a 5 dias) -> liberado", futura.resultado === "liberado", `-> ${futura.resultado}`);

  const paga = decidirAcesso("ativa", "bloquear", [mensalidade({ data: haDias(5), status: "pago" })]);
  check("mensalidade paga vencida -> liberado (não conta)", paga.resultado === "liberado", `-> ${paga.resultado}`);
}

console.log("\n3. Política decide o resultado quando há mensalidade vencida");
{
  const vencida = [mensalidade({ data: haDias(10), valor: 150 })];

  const lib = decidirAcesso("ativa", "liberar", vencida);
  check("liberar -> liberado", lib.resultado === "liberado", `-> ${lib.resultado}`);
  check("liberar -> ainda registra dados financeiros", lib.quantidadeVencida === 1);

  const alerta = decidirAcesso("ativa", "alertar", vencida);
  check("alertar -> alerta (entra, mas com aviso)", alerta.resultado === "alerta", `-> ${alerta.resultado}`);

  const bloq = decidirAcesso("ativa", "bloquear", vencida);
  check("bloquear -> bloqueado", bloq.resultado === "bloqueado", `-> ${bloq.resultado}`);
  check("bloqueado -> motivo cita a política", bloq.motivo.includes("política"), `-> ${bloq.motivo}`);
}

console.log("\n4. Referência financeira usa a mensalidade vencida mais antiga");
{
  const vencidas = [
    mensalidade({ id: "recente", data: haDias(3), valor: 100 }),
    mensalidade({ id: "antiga", data: haDias(20), valor: 150, competencia: "2026-06" }),
  ];
  const r = decidirAcesso("ativa", "alertar", vencidas);
  check("mensalidadeId = a mais antiga", r.mensalidadeId === "antiga", `-> ${r.mensalidadeId}`);
  check("diasAtraso = 20", r.diasAtraso === 20, `-> ${r.diasAtraso}`);
  check("quantidadeVencida = 2", r.quantidadeVencida === 2);
  check("totalVencido = soma das duas", r.totalVencido === 250, `-> ${r.totalVencido}`);
}

console.log("\n5. statusLiberacaoDe alimenta a retenção corretamente (migration 030)");
{
  // migration 030: retencao_alunos só conta status_liberacao IN ('liberado','alerta').
  // Este teste garante que a única função que decide acesso nunca produz um
  // valor gravado que a retenção acidentalmente conte como presença.
  check("liberado -> liberado", statusLiberacaoDe("liberado") === "liberado");
  check("alerta -> alerta", statusLiberacaoDe("alerta") === "alerta");
  check("bloqueado -> negado (fora da retenção)", statusLiberacaoDe("bloqueado") === "negado");
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
