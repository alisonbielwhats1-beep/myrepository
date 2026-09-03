/**
 * Testes de decidirAcesso e statusLiberacaoDe (Fase 8 — Recepção).
 *
 * Roda com: npm run test:acessos
 * Mesmo esquema dos outros testes do projeto: compila lib/utils.ts +
 * lib/types.ts para .test-build/ e roda com Node puro, sem framework.
 */
import {
  decidirAcesso,
  statusLiberacaoDe,
  hojeSaoPaulo,
  origemExigePlanoDaAcademia,
  resolverStatusMatricula,
  rotuloRecorrencia,
} from "../.test-build/utils.js";

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

console.log("\n6. Origem de acesso do aluno separada da periodicidade (migration 096)");
{
  // Só o plano da academia exige plano — é o que libera Wellhub/TotalPass do
  // plano-fantasma que a academia era obrigada a criar.
  check("plano da academia exige plano", origemExigePlanoDaAcademia("plano_academia") === true);
  check("wellhub não exige plano", origemExigePlanoDaAcademia("wellhub") === false);
  check("totalpass não exige plano", origemExigePlanoDaAcademia("totalpass") === false);
  check("avulso não exige plano", origemExigePlanoDaAcademia("avulso") === false);
  check("outro convênio não exige plano", origemExigePlanoDaAcademia("outro_convenio") === false);

  // A trava histórica continua valendo onde sempre fez sentido.
  check(
    "plano da academia SEM plano + ativa -> pendente (regra da Fase 4 intacta)",
    resolverStatusMatricula("plano_academia", null, "ativa") === "pendente"
  );
  check(
    "plano da academia COM plano + ativa -> ativa",
    resolverStatusMatricula("plano_academia", "plano-1", "ativa") === "ativa"
  );
  check(
    "plano da academia SEM plano + trancada -> trancada (escolha explícita do admin)",
    resolverStatusMatricula("plano_academia", null, "trancada") === "trancada"
  );

  // O ponto do pedido: aluno de parceiro fica ativo sem plano da academia.
  check(
    "wellhub sem plano + ativa -> ativa (não vira pendente)",
    resolverStatusMatricula("wellhub", null, "ativa") === "ativa"
  );
  check(
    "totalpass sem plano + ativa -> ativa",
    resolverStatusMatricula("totalpass", null, "ativa") === "ativa"
  );
  check(
    "avulso sem plano + ativa -> ativa",
    resolverStatusMatricula("avulso", null, "ativa") === "ativa"
  );
  check(
    "outro convênio sem plano + ativa -> ativa",
    resolverStatusMatricula("outro_convenio", null, "ativa") === "ativa"
  );
  check(
    "parceiro com plano legado preservado + ativa -> ativa",
    resolverStatusMatricula("wellhub", "plano-fantasma", "ativa") === "ativa"
  );
  check(
    "parceiro cancelado continua cancelado",
    resolverStatusMatricula("wellhub", null, "cancelada") === "cancelada"
  );

  // E o aluno de parceiro, sem mensalidade, passa na catraca: decidirAcesso
  // olha status + mensalidades, e não o plano.
  const parceiro = decidirAcesso(
    resolverStatusMatricula("wellhub", null, "ativa"),
    "bloquear",
    []
  );
  check(
    "aluno Wellhub sem mensalidade libera mesmo na política mais dura",
    parceiro.resultado === "liberado",
    `-> ${parceiro.resultado}`
  );
  // Antes da migration 096 o mesmo aluno era forçado a "pendente" e barrava.
  const antes = decidirAcesso("pendente", "liberar", []);
  check(
    "prova do problema antigo: pendente era bloqueado",
    antes.resultado === "bloqueado",
    `-> ${antes.resultado}`
  );
}

console.log("\n7. Periodicidade em palavra (única fonte, sem cópias divergentes)");
{
  check("1 mês -> mensal", rotuloRecorrencia(1) === "mensal");
  check("3 meses -> trimestral", rotuloRecorrencia(3) === "trimestral");
  check("6 meses -> semestral", rotuloRecorrencia(6) === "semestral");
  check("12 meses -> anual", rotuloRecorrencia(12) === "anual");
  check("4 meses -> a cada 4 meses", rotuloRecorrencia(4) === "a cada 4 meses");
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
