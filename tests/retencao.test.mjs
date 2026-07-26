/**
 * Testes da função central de retenção (Fase 6).
 *
 * Roda com: npm run test:retencao
 * O script compila lib/utils.ts + lib/types.ts para .test-build/ e executa
 * este arquivo com o Node. Não há framework de teste no projeto; as asserções
 * são explícitas de propósito, para o teste rodar sem nenhuma dependência nova.
 */
import {
  classificarRetencao,
  configRetencaoDe,
  hojeSaoPaulo,
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

// Config padrão da migration 029: atencao=7, risco=10, sumido=14, tolerancia=7.
const CONFIG = configRetencaoDe({});

const hoje = hojeSaoPaulo();
/** Timestamp ISO de N dias atrás, ao meio-dia UTC (evita virada de fuso). */
function haDias(n) {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}
const ativo = (diasDesdeMatricula) => ({
  criado_em: haDias(diasDesdeMatricula),
  status_matricula: "ativa",
});

console.log("\n0. Config padrao reproduz os cortes que ja existiam");
{
  check("atencao=7", CONFIG.diasAtencao === 7, `-> ${CONFIG.diasAtencao}`);
  check("risco=10 (corte antigo da Retencao)", CONFIG.diasRisco === 10, `-> ${CONFIG.diasRisco}`);
  check("sumido=14 (corte antigo do painel)", CONFIG.diasSumido === 14, `-> ${CONFIG.diasSumido}`);
  check("tolerancia=7", CONFIG.toleranciaNovoAluno === 7);
}

console.log("\n1. Aluno ativo com acesso recente");
{
  const r = classificarRetencao(ativo(60), haDias(2), CONFIG);
  check("classificacao normal", r.classificacao === "normal", `-> ${r.classificacao}`);
  check("2 dias sem acesso", r.diasSemAcesso === 2, `-> ${r.diasSemAcesso}`);
  check("nuncaAcessou = false", r.nuncaAcessou === false);
  check("explicacao sem rotulo", r.explicacao === "Sem acesso há 2 dia(s)", `-> ${r.explicacao}`);

  const hj = classificarRetencao(ativo(60), haDias(0), CONFIG);
  check("acesso hoje -> 'Acessou hoje'", hj.explicacao === "Acessou hoje", `-> ${hj.explicacao}`);
}

console.log("\n2. Limites exatos de quem ja acessou");
{
  const casos = [
    [6, "normal"], [7, "atencao"], [9, "atencao"],
    [10, "em_risco"], [13, "em_risco"],
    [14, "sumido"], [30, "sumido"],
  ];
  for (const [dias, esperado] of casos) {
    const r = classificarRetencao(ativo(90), haDias(dias), CONFIG);
    check(`${dias} dias -> ${esperado}`, r.classificacao === esperado, `-> ${r.classificacao}`);
  }
  const r10 = classificarRetencao(ativo(90), haDias(10), CONFIG);
  check(
    "explicacao traz o rotulo",
    r10.explicacao === "Sem acesso há 10 dia(s) — em risco",
    `-> ${r10.explicacao}`
  );
}

console.log("\n3. Aluno novo que nunca acessou");
{
  const casos = [
    [5, "normal"],   // dentro da tolerancia
    [7, "normal"],   // limite da tolerancia ainda protege
    [8, "atencao"],  // dias TOTAIS desde a matricula
    [11, "em_risco"],
    [15, "sumido"],
  ];
  for (const [dias, esperado] of casos) {
    const r = classificarRetencao(ativo(dias), null, CONFIG);
    check(`matriculado ha ${dias} dias -> ${esperado}`, r.classificacao === esperado, `-> ${r.classificacao}`);
  }
}

console.log("\n4. Tolerancia adia a avaliacao, mas NAO desloca os limites");
{
  // Se a tolerancia fosse somada, 8 dias viraria 1 dia efetivo e daria normal.
  const r = classificarRetencao(ativo(8), null, CONFIG);
  check("8 dias nao vira normal por soma da tolerancia", r.classificacao === "atencao", `-> ${r.classificacao}`);
  const s = classificarRetencao(ativo(14), null, CONFIG);
  check("14 dias totais ja e sumido (e nao 14+7)", s.classificacao === "sumido", `-> ${s.classificacao}`);
}

console.log("\n5. Campos e explicacoes de quem nunca acessou");
{
  const dentro = classificarRetencao(ativo(3), null, CONFIG);
  check(
    "dentro: 'Nunca acessou — matriculado há 3 dia(s)'",
    dentro.explicacao === "Nunca acessou — matriculado há 3 dia(s)",
    `-> ${dentro.explicacao}`
  );
  check("dentro: diasSemAcesso null", dentro.diasSemAcesso === null);
  check("dentro: nuncaAcessou true", dentro.nuncaAcessou === true);
  check("dentro: ultimoAcesso null", dentro.ultimoAcesso === null);
  check("dentro: diasDesdeMatricula 3", dentro.diasDesdeMatricula === 3, `-> ${dentro.diasDesdeMatricula}`);

  const fora = classificarRetencao(ativo(12), null, CONFIG);
  check(
    "fora: 'tolerancia encerrada ha 5 dia(s)'",
    fora.explicacao.startsWith("Nunca acessou — tolerância encerrada há 5 dia(s)"),
    `-> ${fora.explicacao}`
  );
  check("fora: traz o rotulo da faixa", fora.explicacao.includes("em risco"), `-> ${fora.explicacao}`);
}

console.log("\n6. Escopo: apenas matricula ativa entra na retencao");
{
  for (const s of ["trancada", "inativa", "pendente", "cancelada"]) {
    const r = classificarRetencao({ criado_em: haDias(90), status_matricula: s }, haDias(60), CONFIG);
    check(`${s} -> fora da retencao (null)`, r === null, `-> ${JSON.stringify(r)}`);
  }
  const at = classificarRetencao(ativo(90), haDias(60), CONFIG);
  check("ativa -> entra e e classificada", at !== null && at.classificacao === "sumido");
}

console.log("\n7. Dashboard e Retencao classificam o mesmo aluno igualmente");
{
  const linha = { criado_em: haDias(200), ultimo_acesso: haDias(16) };
  const noPainel = classificarRetencao(
    { criado_em: linha.criado_em, status_matricula: "ativa" }, linha.ultimo_acesso, CONFIG);
  const naRetencao = classificarRetencao(
    { criado_em: linha.criado_em, status_matricula: "ativa" }, linha.ultimo_acesso, CONFIG);
  check("mesma classificacao", noPainel.classificacao === naRetencao.classificacao);
  check("mesma explicacao", noPainel.explicacao === naRetencao.explicacao);
  check("mesmos dias sem acesso", noPainel.diasSemAcesso === naRetencao.diasSemAcesso);

  // Painel conta so "sumido"; Retencao mostra atencao + em_risco + sumido.
  const amostra = [
    classificarRetencao(ativo(200), haDias(3), CONFIG),
    classificarRetencao(ativo(200), haDias(8), CONFIG),
    classificarRetencao(ativo(200), haDias(11), CONFIG),
    classificarRetencao(ativo(200), haDias(20), CONFIG),
  ];
  const doPainel = amostra.filter((r) => r.classificacao === "sumido").length;
  const daRetencao = amostra.filter((r) => r.classificacao !== "normal").length;
  check("painel conta 1 sumido", doPainel === 1, `-> ${doPainel}`);
  check("retencao lista 3 (atencao+risco+sumido)", daRetencao === 3, `-> ${daRetencao}`);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
