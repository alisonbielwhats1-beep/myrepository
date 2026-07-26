/**
 * Testes do núcleo financeiro (Fase 7A).
 *
 * Roda com: npm run test:financeiro
 * O script compila lib/ para .test-build-fin/ em CommonJS e executa este arquivo.
 * Sem framework de teste: asserções explícitas, zero dependência nova.
 */
const {
  calcularCaixaPeriodo,
  calcularContasAReceber,
  calcularContasAPagar,
  calcularSaldoRegistrado,
  calcularSaldoProjetado,
  calcularDRE,
  contarIncompletos,
  agruparFinanceiro,
} = require("../.test-build-fin/financeiro");
const { paraCentavos, paraReais, somarValores } = require("../.test-build-fin/dinheiro");
const { hojeSaoPaulo } = require("../.test-build-fin/utils");

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
function deslocar(dias) {
  const d = new Date(`${hoje}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const ONTEM = deslocar(-1);
const AMANHA = deslocar(1);

const rec = (o) => ({
  id: o.id ?? "r", tipo: o.tipo ?? "mensalidade", valor: o.valor,
  data: o.data, competencia: o.competencia ?? null, status: o.status,
  data_pagamento: o.data_pagamento ?? null, forma_pagamento: o.forma ?? null,
});
const desp = (o) => ({
  id: o.id ?? "d", categoria: o.categoria ?? "outros", valor: o.valor,
  data: o.data, competencia: o.competencia ?? null, status: o.status,
  data_pagamento: o.data_pagamento ?? null, forma_pagamento: null,
});

// ---------------------------------------------------------------------------
console.log("\n1. Caixa usa data_pagamento — vencimento NAO define caixa");
{
  // Vence em junho, pago em julho: e receita de JULHO no regime de caixa.
  const receitas = [rec({
    valor: 100, data: "2026-06-30", competencia: "2026-06-01",
    status: "pago", data_pagamento: "2026-07-05",
  })];

  const junho = calcularCaixaPeriodo(receitas, [], "2026-06-01", "2026-06-30");
  const julho = calcularCaixaPeriodo(receitas, [], "2026-07-01", "2026-07-31");
  check("nao entra no mes do vencimento", junho.receitaRecebida === 0, `-> ${junho.receitaRecebida}`);
  check("entra no mes do pagamento", julho.receitaRecebida === 100, `-> ${julho.receitaRecebida}`);
}

console.log("\n2. Somente status pago entra no caixa");
{
  const receitas = [
    rec({ id: "a", valor: 50, data: hoje, status: "pendente", data_pagamento: null }),
    rec({ id: "b", valor: 70, data: hoje, status: "cancelada", data_pagamento: hoje }),
    rec({ id: "c", valor: 30, data: hoje, status: "pago", data_pagamento: hoje }),
  ];
  const c = calcularCaixaPeriodo(receitas, [], hoje, hoje);
  check("so a paga conta", c.receitaRecebida === 30, `-> ${c.receitaRecebida}`);
}

console.log("\n3. Resultado do periodo = recebido - pago");
{
  const receitas = [rec({ valor: 1000, data: hoje, status: "pago", data_pagamento: hoje })];
  const despesas = [desp({ valor: 399.9, data: hoje, status: "pago", data_pagamento: hoje })];
  const c = calcularCaixaPeriodo(receitas, despesas, hoje, hoje);
  check("receita 1000", c.receitaRecebida === 1000);
  check("despesa 399.90", c.despesaPaga === 399.9);
  check("resultado 600.10 exato", c.resultado === 600.1, `-> ${c.resultado}`);
}

console.log("\n4. Despesa paga sem data_pagamento fica fora do caixa");
{
  const despesas = [desp({ valor: 500, data: hoje, status: "pago", data_pagamento: null })];
  const c = calcularCaixaPeriodo([], despesas, "2000-01-01", "2100-01-01");
  check("nao entra no caixa", c.despesaPaga === 0, `-> ${c.despesaPaga}`);
  const inc = contarIncompletos([], despesas);
  check("aparece como incompleta", inc.despesas === 1 && inc.despesasValor === 500);
}

// ---------------------------------------------------------------------------
console.log("\n5. Vencido vs futuro — limites ontem / hoje / amanha em SP");
{
  const receitas = [
    rec({ id: "v", valor: 100, data: ONTEM, status: "pendente" }),
    rec({ id: "h", valor: 200, data: hoje, status: "pendente" }),
    rec({ id: "f", valor: 300, data: AMANHA, status: "pendente" }),
    rec({ id: "x", valor: 999, data: ONTEM, status: "cancelada" }),
    rec({ id: "p", valor: 888, data: ONTEM, status: "pago", data_pagamento: ONTEM }),
  ];
  const ar = calcularContasAReceber(receitas, hoje);
  check("ontem -> vencido", ar.vencido === 100, `-> ${ar.vencido}`);
  check("hoje -> futuro (nao vencido ainda)", ar.futuro === 500, `-> ${ar.futuro}`);
  check("total = vencido + futuro", ar.total === 600, `-> ${ar.total}`);
  check("cancelada ignorada", ar.total === 600);
  check("paga nao entra em pendencia", ar.qtdVencido === 1 && ar.qtdFuturo === 2);

  const despesas = [
    desp({ id: "dv", valor: 40, data: ONTEM, status: "pendente" }),
    desp({ id: "df", valor: 60, data: AMANHA, status: "pendente" }),
  ];
  const ap = calcularContasAPagar(despesas, hoje);
  check("a pagar separa igual", ap.vencido === 40 && ap.futuro === 60 && ap.total === 100);
}

// ---------------------------------------------------------------------------
console.log("\n6. Saldo registrado");
{
  const receitas = [
    rec({ id: "1", valor: 100, data: "2026-01-10", status: "pago", data_pagamento: "2026-01-10" }),
    rec({ id: "2", valor: 200, data: "2026-03-10", status: "pago", data_pagamento: "2026-03-10" }),
  ];
  const despesas = [
    desp({ id: "3", valor: 50, data: "2026-02-01", status: "pago", data_pagamento: "2026-02-01" }),
  ];

  const semData = calcularSaldoRegistrado(receitas, despesas, 0, null);
  check("sem data_saldo_inicial usa 1o lancamento", semData.desde === "2026-01-10", `-> ${semData.desde}`);
  check("saldo = 100 + 200 - 50", semData.saldo === 250, `-> ${semData.saldo}`);

  const comCorte = calcularSaldoRegistrado(receitas, despesas, 1000, "2026-02-15");
  check("corte ignora o que veio antes", comCorte.recebido === 200, `-> ${comCorte.recebido}`);
  check("despesa antes do corte tambem sai", comCorte.pago === 0, `-> ${comCorte.pago}`);
  check("saldo = 1000 + 200", comCorte.saldo === 1200, `-> ${comCorte.saldo}`);

  const soInicial = calcularSaldoRegistrado([], [], 500, null);
  check("sem lancamentos, saldo = inicial", soInicial.saldo === 500 && soInicial.desde === null);
}

console.log("\n7. Saldo projetado = registrado + a receber - a pagar");
{
  const p = calcularSaldoProjetado(1000, 250.5, 300.25);
  check("componentes preservados", p.saldoRegistrado === 1000 && p.aReceber === 250.5 && p.aPagar === 300.25);
  check("projetado 950.25 exato", p.projetado === 950.25, `-> ${p.projetado}`);
}

// ---------------------------------------------------------------------------
console.log("\n8. DRE usa competencia, nao vencimento nem pagamento");
{
  const receitas = [
    // Competencia junho, vence junho, paga em julho -> DRE de JUNHO.
    rec({ id: "a", valor: 100, data: "2026-06-30", competencia: "2026-06-01",
          status: "pago", data_pagamento: "2026-07-05" }),
    // Competencia julho, ainda pendente -> entra no DRE de julho mesmo sem pagar.
    rec({ id: "b", valor: 200, data: "2026-07-10", competencia: "2026-07-01", status: "pendente" }),
    // Cancelada nunca entra.
    rec({ id: "c", valor: 900, data: "2026-07-10", competencia: "2026-07-01", status: "cancelada" }),
  ];

  const junho = calcularDRE(receitas, [], "2026-06-01", "2026-06-30");
  const julho = calcularDRE(receitas, [], "2026-07-01", "2026-07-31");
  check("competencia junho no DRE de junho", junho.totalReceita === 100, `-> ${junho.totalReceita}`);
  check("pagamento em julho nao move o DRE", julho.totalReceita === 200, `-> ${julho.totalReceita}`);
  check("pendente entra por competencia", julho.totalReceita === 200);
  check("cancelada fora do DRE", julho.totalReceita === 200);
}

console.log("\n9. DRE: lancamento sem competencia usa a data (fallback)");
{
  const receitas = [rec({ id: "v", tipo: "venda_produto", valor: 80, data: "2026-07-15",
                          competencia: null, status: "pago", data_pagamento: "2026-07-15" })];
  const dre = calcularDRE(receitas, [], "2026-07-01", "2026-07-31");
  check("venda entra no DRE", dre.totalReceita === 80, `-> ${dre.totalReceita}`);
  check("fallback e contabilizado e visivel", dre.semCompetencia === 1, `-> ${dre.semCompetencia}`);
}

console.log("\n10. DRE: lucro e margem");
{
  const receitas = [rec({ valor: 1000, data: "2026-07-01", competencia: "2026-07-01", status: "pago", data_pagamento: "2026-07-01" })];
  const despesas = [desp({ valor: 250, data: "2026-07-01", competencia: "2026-07-01", status: "pago", data_pagamento: "2026-07-01" })];
  const dre = calcularDRE(receitas, despesas, "2026-07-01", "2026-07-31");
  check("lucro 750", dre.lucro === 750, `-> ${dre.lucro}`);
  check("margem 75%", dre.margem === 75, `-> ${dre.margem}`);
}

// ---------------------------------------------------------------------------
console.log("\n11. Periodo altera cards e grafico");
{
  const receitas = [
    rec({ id: "a", valor: 100, data: "2026-07-01", status: "pago", data_pagamento: "2026-07-01" }),
    rec({ id: "b", valor: 200, data: "2026-08-01", status: "pago", data_pagamento: "2026-08-01" }),
  ];
  const jul = calcularCaixaPeriodo(receitas, [], "2026-07-01", "2026-07-31");
  const ago = calcularCaixaPeriodo(receitas, [], "2026-08-01", "2026-08-31");
  const amplo = calcularCaixaPeriodo(receitas, [], "2026-07-01", "2026-08-31");
  check("julho isolado", jul.receitaRecebida === 100, `-> ${jul.receitaRecebida}`);
  check("agosto isolado", ago.receitaRecebida === 200, `-> ${ago.receitaRecebida}`);
  check("periodo amplo soma", amplo.receitaRecebida === 300, `-> ${amplo.receitaRecebida}`);

  const serie = agruparFinanceiro(receitas, [], "2026-07-01", "2026-07-31");
  const totalSerie = serie.reduce((s, p) => s + p.receita, 0);
  check("grafico respeita o mesmo periodo", totalSerie === 100, `-> ${totalSerie}`);

  const cancelada = [rec({ id: "c", valor: 500, data: "2026-07-10", status: "cancelada" })];
  const serieC = agruparFinanceiro(cancelada, [], "2026-07-01", "2026-07-31");
  const projC = serieC.reduce((s, p) => s + (p.projetado ?? 0), 0);
  check("cancelada nao infla o projetado do grafico", projC === 0, `-> ${projC}`);
}

// ---------------------------------------------------------------------------
console.log("\n12. Precisao em centavos");
{
  check("0.1 + 0.2 = 0.30", somarValores([0.1, 0.2]) === 0.3, `-> ${somarValores([0.1, 0.2])}`);
  const centavos = Array.from({ length: 1000 }, () => 0.07);
  check("1000 x 0.07 = 70.00", somarValores(centavos) === 70, `-> ${somarValores(centavos)}`);
  check("paraCentavos arredonda", paraCentavos(19.999) === 2000, `-> ${paraCentavos(19.999)}`);
  check("paraCentavos aceita string do Postgres", paraCentavos("479.90") === 47990);
  check("paraReais volta com 2 casas", paraReais(47990) === 479.9);

  const receitas = Array.from({ length: 3 }, (_, i) =>
    rec({ id: String(i), valor: 0.1, data: hoje, status: "pago", data_pagamento: hoje }));
  const c = calcularCaixaPeriodo(receitas, [], hoje, hoje);
  check("3 x 0.10 = 0.30 no KPI", c.receitaRecebida === 0.3, `-> ${c.receitaRecebida}`);
}

// ---------------------------------------------------------------------------
console.log("\n13. DRE separa recebido/a receber e pago/a pagar");
{
  const receitas = [
    rec({ id: "a", valor: 300, data: "2026-07-05", competencia: "2026-07-01",
          status: "pago", data_pagamento: "2026-07-05" }),
    rec({ id: "b", valor: 200, data: "2026-07-20", competencia: "2026-07-01", status: "pendente" }),
  ];
  const despesas = [
    desp({ id: "c", valor: 100, data: "2026-07-03", competencia: "2026-07-01",
           status: "pago", data_pagamento: "2026-07-03" }),
    desp({ id: "d", valor: 50, data: "2026-07-28", competencia: "2026-07-01", status: "pendente" }),
  ];
  const dre = calcularDRE(receitas, despesas, "2026-07-01", "2026-07-31");
  check("receita total 500", dre.totalReceita === 500, `-> ${dre.totalReceita}`);
  check("recebido 300", dre.receitaRecebida === 300, `-> ${dre.receitaRecebida}`);
  check("a receber 200", dre.receitaAReceber === 200, `-> ${dre.receitaAReceber}`);
  check("despesa total 150", dre.totalDespesa === 150, `-> ${dre.totalDespesa}`);
  check("pago 100", dre.despesaPaga === 100, `-> ${dre.despesaPaga}`);
  check("a pagar 50", dre.despesaAPagar === 50, `-> ${dre.despesaAPagar}`);
  check("resultado por competencia 350", dre.lucro === 350, `-> ${dre.lucro}`);
  check("resultado NAO e o caixa do periodo",
    dre.lucro !== calcularCaixaPeriodo(receitas, despesas, "2026-07-01", "2026-07-31").resultado);
}

console.log("\n14. Saldo inicial negativo e data de corte");
{
  const receitas = [rec({ valor: 100, data: "2026-05-01", status: "pago", data_pagamento: "2026-05-01" })];
  const neg = calcularSaldoRegistrado(receitas, [], -250.75, "2026-01-01");
  check("aceita saldo inicial negativo", neg.saldoInicial === -250.75, `-> ${neg.saldoInicial}`);
  check("saldo = -250.75 + 100", neg.saldo === -150.75, `-> ${neg.saldo}`);

  const zero = calcularSaldoRegistrado(receitas, [], 0, "2026-01-01");
  check("aceita zero", zero.saldoInicial === 0 && zero.saldo === 100);

  const corteDepois = calcularSaldoRegistrado(receitas, [], 0, "2026-06-01");
  check("lancamento anterior ao corte fica fora", corteDepois.saldo === 0, `-> ${corteDepois.saldo}`);
  check("desde respeita a data configurada", corteDepois.desde === "2026-06-01");
}

console.log("\n15. Adaptadores da RPC produzem o mesmo formato das funcoes puras");
{
  const { caixaDoResumo, pendenciasDoResumo, saldoDoResumo, montarDRE } =
    require("../.test-build-fin/financeiro");

  // Mesmo cenario do bloco 3, agora vindo agregado do banco.
  const resumoRPC = {
    receita_recebida: "1000.00", despesa_paga: "399.90", resultado: "600.10",
    receber_vencido: "100.00", receber_futuro: "500.00",
    receber_qtd_vencido: 1, receber_qtd_futuro: 2,
    pagar_vencido: "40.00", pagar_futuro: "60.00",
    pagar_qtd_vencido: 1, pagar_qtd_futuro: 1,
    saldo_inicial: "0.00", saldo_desde: "2026-01-10",
    saldo_recebido: "300.00", saldo_pago: "50.00", saldo: "250.00",
    incompletas_receitas: 0, incompletas_receitas_valor: "0.00",
    incompletas_despesas: 1, incompletas_despesas_valor: "500.00",
  };

  const cx = caixaDoResumo(resumoRPC);
  check("caixa agregado == caixa puro (bloco 3)",
    cx.receitaRecebida === 1000 && cx.despesaPaga === 399.9 && cx.resultado === 600.1);

  const ar = pendenciasDoResumo(resumoRPC, "receber");
  check("pendencias agregadas == puras (bloco 5)",
    ar.vencido === 100 && ar.futuro === 500 && ar.total === 600);

  const sr = saldoDoResumo(resumoRPC);
  check("saldo agregado == puro (bloco 6)", sr.saldo === 250 && sr.desde === "2026-01-10");

  // Numeric do Postgres chega como string: nao pode virar NaN nem perder centavo.
  check("string numeric convertida sem perda", cx.despesaPaga === 399.9);

  const dreRPC = montarDRE([
    { escopo: "receita", chave: "mensalidade", total: "500.00", realizado: "300.00", em_aberto: "200.00", sem_competencia: 0 },
    { escopo: "despesa", chave: "outros", total: "150.00", realizado: "100.00", em_aberto: "50.00", sem_competencia: 0 },
  ]);
  check("DRE agregado == DRE puro (bloco 13)",
    dreRPC.totalReceita === 500 && dreRPC.receitaRecebida === 300 &&
    dreRPC.receitaAReceber === 200 && dreRPC.totalDespesa === 150 &&
    dreRPC.despesaPaga === 100 && dreRPC.despesaAPagar === 50 && dreRPC.lucro === 350);
  check("margem identica", dreRPC.margem === 70, `-> ${dreRPC.margem}`);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
