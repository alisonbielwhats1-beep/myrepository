const assert = require("node:assert/strict");

const { parseIntelligenceQuestion } = require("../.test-build-intelligence/intelligence/parser.js");

const TODAY = "2026-08-14";

function parse(question) {
  return parseIntelligenceQuestion(question, TODAY);
}

const intents = [
  ["Quem está sumido?", "missing_students"],
  ["Quem não aparece para treinar?", "missing_students"],
  ["Quem está devendo?", "overdue_students"],
  ["Mensalidade vencida", "overdue_students"],
  ["Quanto faturei este mês?", "revenue"],
  ["Como está meu financeiro?", "financial_summary"],
  ["Quantos check-ins tivemos ontem?", "checkins"],
  ["Qual foi o horário mais movimentado ontem?", "peak_hour"],
  ["Quantos novos alunos entraram?", "new_students"],
  ["Quantos alunos ativos tenho?", "active_students"],
  ["Quais planos vencem esta semana?", "expiring_plans"],
  ["Como foi julho?", "business_summary"],
  ["Como foi o mês passado?", "business_summary"],
  ["Compare julho com junho", "compare_periods"],
  ["Qual aparelho quebrou?", "unknown"],
];

for (const [question, expected] of intents) {
  assert.equal(parse(question).intent, expected, question);
}

assert.deepEqual(parse("Quanto faturei?").period, {
  start: "2026-08-01",
  end: "2026-08-31",
  label: "Agosto de 2026",
  kind: "month",
  explicit: false,
});

assert.deepEqual(parse("Quantos check-ins tivemos?").period, {
  start: TODAY,
  end: TODAY,
  label: "Hoje",
  kind: "day",
  explicit: false,
});

assert.equal(parse("Quanto faturei em julho?").period.start, "2026-07-01");
assert.equal(parse("Quanto faturei em julho?").period.end, "2026-07-31");
assert.equal(parse("Quanto faturei em dezembro?").period.start, "2025-12-01");
assert.equal(parse("Quanto faturei ontem?").period.start, "2026-08-13");
assert.equal(parse("Check-ins dos últimos 7 dias").period.start, "2026-08-08");
assert.equal(parse("Planos nos próximos 15 dias").period.end, "2026-08-28");

const range = parse("Quanto faturei entre 01/07 e 15/07?").period;
assert.equal(range.start, "2026-07-01");
assert.equal(range.end, "2026-07-15");

const explicitRange = parse("Receita de 01/07/2026 até 15/07/2026").period;
assert.equal(explicitRange.start, "2026-07-01");
assert.equal(explicitRange.end, "2026-07-15");

const comparison = parse("Compare julho com junho").comparison;
assert.equal(comparison.periodA.start, "2026-07-01");
assert.equal(comparison.periodB.start, "2026-06-01");

const relativeComparison = parse("Compare este mês com o anterior").comparison;
assert.equal(relativeComparison.periodA.start, "2026-08-01");
assert.equal(relativeComparison.periodB.start, "2026-07-01");

console.log("Intelligence parser: todos os cenários passaram.");
