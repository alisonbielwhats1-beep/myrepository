/**
 * Testes de lib/vencimento.ts — dia de vencimento 1 a 31 (2026-08-11).
 *
 * Roda com: npm run test:vencimento
 *
 * O foco é o caso que motivou a mudança: o cliente cobra no dia 31 e fevereiro
 * não tem dia 31. Nenhuma cobrança pode deixar de ser gerada por causa disso, e
 * nenhuma data inválida (30/02) pode ser produzida.
 */
import {
  ultimoDiaDoMes,
  diaVencimentoDoMes,
  lerDiaVencimento,
  rotuloDiaVencimento,
  DIA_VENCIMENTO_MAX,
} from "../.test-build-venc/vencimento.js";

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
function igual(nome, obtido, esperado) {
  check(nome, obtido === esperado, `-> ${obtido} (esperado ${esperado})`);
}

console.log("\n1. ultimoDiaDoMes — os quatro tamanhos de mês");
{
  igual("janeiro tem 31", ultimoDiaDoMes(2026, 1), 31);
  igual("fevereiro comum tem 28", ultimoDiaDoMes(2026, 2), 28);
  igual("fevereiro bissexto tem 29", ultimoDiaDoMes(2028, 2), 29);
  igual("abril tem 30", ultimoDiaDoMes(2026, 4), 30);
  igual("dezembro tem 31", ultimoDiaDoMes(2026, 12), 31);
}

console.log("\n2. ultimoDiaDoMes — regra completa do ano bissexto");
{
  igual("2024 é bissexto (divisível por 4)", ultimoDiaDoMes(2024, 2), 29);
  igual("2100 NÃO é bissexto (século não divisível por 400)", ultimoDiaDoMes(2100, 2), 28);
  igual("2000 é bissexto (divisível por 400)", ultimoDiaDoMes(2000, 2), 29);
}

console.log("\n3. diaVencimentoDoMes — o caso do cliente: dia 31");
{
  igual("31 em janeiro -> 31", diaVencimentoDoMes(31, 2026, 1), 31);
  igual("31 em fevereiro comum -> 28", diaVencimentoDoMes(31, 2026, 2), 28);
  igual("31 em fevereiro bissexto -> 29", diaVencimentoDoMes(31, 2028, 2), 29);
  igual("31 em abril -> 30", diaVencimentoDoMes(31, 2026, 4), 30);
  igual("30 em fevereiro -> 28", diaVencimentoDoMes(30, 2026, 2), 28);
  igual("29 em fevereiro comum -> 28", diaVencimentoDoMes(29, 2026, 2), 28);
  igual("29 em fevereiro bissexto -> 29", diaVencimentoDoMes(29, 2028, 2), 29);
}

console.log("\n4. diaVencimentoDoMes — dias normais nunca mudam");
{
  for (const mes of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const d = diaVencimentoDoMes(10, 2026, mes);
    if (d !== 10) {
      check(`dia 10 preservado no mês ${mes}`, false, `-> ${d}`);
    }
  }
  check("dia 10 preservado nos 12 meses", true);
  igual("dia 1 preservado em fevereiro", diaVencimentoDoMes(1, 2026, 2), 1);
  igual("dia 28 preservado em fevereiro", diaVencimentoDoMes(28, 2026, 2), 28);
}

console.log("\n5. diaVencimentoDoMes — NUNCA produz data inexistente");
{
  const invalidos = [];
  for (let ano = 2024; ano <= 2029; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      for (let dia = 1; dia <= DIA_VENCIMENTO_MAX; dia++) {
        const real = diaVencimentoDoMes(dia, ano, mes);
        const data = new Date(Date.UTC(ano, mes - 1, real));
        // Se o dia não existisse, o Date "transbordaria" para o mês seguinte.
        if (data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== real) {
          invalidos.push(`${dia}/${mes}/${ano} -> ${real}`);
        }
      }
    }
  }
  check(
    "6 anos x 12 meses x 31 dias sempre geram data existente",
    invalidos.length === 0,
    `-> ${invalidos.slice(0, 3).join(", ")}`
  );
}

console.log("\n6. diaVencimentoDoMes — valores estragados não somem com a cobrança");
{
  igual("dia 0 vira 1", diaVencimentoDoMes(0, 2026, 3), 1);
  igual("dia negativo vira 1", diaVencimentoDoMes(-5, 2026, 3), 1);
  igual("dia 99 vira o último do mês", diaVencimentoDoMes(99, 2026, 2), 28);
  igual("dia quebrado é truncado", diaVencimentoDoMes(15.7, 2026, 3), 15);
  igual("NaN vira 1", diaVencimentoDoMes(NaN, 2026, 3), 1);
}

console.log("\n7. lerDiaVencimento — entrada de formulário e planilha");
{
  igual("'31' -> 31", lerDiaVencimento("31"), 31);
  igual("'1' -> 1", lerDiaVencimento("1"), 1);
  igual("número 15 -> 15", lerDiaVencimento(15), 15);
  igual("vazio -> null", lerDiaVencimento(""), null);
  igual("null -> null", lerDiaVencimento(null), null);
  igual("undefined -> null", lerDiaVencimento(undefined), null);
  igual("0 -> null (fora do intervalo)", lerDiaVencimento("0"), null);
  igual("32 -> null (fora do intervalo)", lerDiaVencimento("32"), null);
  igual("texto -> null", lerDiaVencimento("abc"), null);
}

console.log("\n8. rotuloDiaVencimento — a tela explica os meses curtos");
{
  igual("dia 10", rotuloDiaVencimento(10), "Dia 10");
  igual("dia 28 ainda é literal", rotuloDiaVencimento(28), "Dia 28");
  igual("dia 31 avisa", rotuloDiaVencimento(31), "Dia 31 (ou o último do mês)");
  igual("dia 29 avisa", rotuloDiaVencimento(29), "Dia 29 (ou o último do mês)");
  igual("sem dia", rotuloDiaVencimento(null), "—");
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
