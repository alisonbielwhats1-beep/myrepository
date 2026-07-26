/**
 * Testes da regra de cobranças recorrentes.
 *
 * Roda com: npm run test:cobrancas
 *
 * ATENÇÃO: estes testes cobrem lib/cobrancas.ts, que é o ESPELHO da regra. A
 * implementação de produção é a RPC sincronizar_cobrancas_academia (migration
 * 032). As duas precisam ser mantidas em sincronia manualmente — este teste
 * valida a especificação, não o SQL em execução.
 */
const {
  competenciasAGerar,
  elegivelParaCobranca,
} = require("../.test-build-cob/cobrancas");

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

const comps = (r) => r.map((x) => x.competencia).join(",");

// ---------------------------------------------------------------------------
console.log("\n1. Plano mensal");
{
  // Aluno mensal, vencimento dia 26, ancora em janeiro.
  const base = { anchorISO: "2026-01-10", diaVencimento: 26, recorrenciaMeses: 1 };

  const dia18 = competenciasAGerar({ ...base, hojeISO: "2026-08-18" });
  check("18/08: ainda faltam 8 dias, nao cria agosto", comps(dia18) === "", `-> ${comps(dia18)}`);

  const dia19 = competenciasAGerar({ ...base, hojeISO: "2026-08-19" });
  check("19/08: 7 dias exatos, cria agosto", comps(dia19) === "2026-08-01", `-> ${comps(dia19)}`);
  check("vencimento correto", dia19[0]?.vencimento === "2026-08-26", `-> ${dia19[0]?.vencimento}`);

  const dia26 = competenciasAGerar({ ...base, hojeISO: "2026-08-26" });
  check("26/08: no dia do vencimento, continua criando", comps(dia26) === "2026-08-01");

  const dia28 = competenciasAGerar({ ...base, hojeISO: "2026-08-28" });
  check("28/08: agosto vencido segue na janela do mes", comps(dia28) === "2026-08-01", `-> ${comps(dia28)}`);
}

console.log("\n2. Limite exato de 7 dias");
{
  const base = { anchorISO: "2026-01-01", diaVencimento: 10, recorrenciaMeses: 1 };
  // Vencimento 10/09. Janela abre em 03/09.
  const d02 = competenciasAGerar({ ...base, hojeISO: "2026-09-02" });
  const d03 = competenciasAGerar({ ...base, hojeISO: "2026-09-03" });
  check("02/09 (8 dias antes): nao cria", !d03.length ? false : comps(d02) === "", `-> ${comps(d02)}`);
  check("03/09 (7 dias antes): cria", comps(d03) === "2026-09-01", `-> ${comps(d03)}`);

  // Antecedencia configuravel continua respeitando o limite exato.
  const zero = competenciasAGerar({ ...base, hojeISO: "2026-09-09", diasAntecedencia: 0 });
  const noDia = competenciasAGerar({ ...base, hojeISO: "2026-09-10", diasAntecedencia: 0 });
  check("antecedencia 0: vespera nao cria", comps(zero) === "", `-> ${comps(zero)}`);
  check("antecedencia 0: no dia cria", comps(noDia) === "2026-09-01", `-> ${comps(noDia)}`);
}

console.log("\n3. Plano trimestral");
{
  // Ancora janeiro/2026, ciclo 3 meses -> jan, abr, jul, out.
  const base = { anchorISO: "2026-01-15", diaVencimento: 5, recorrenciaMeses: 3 };

  const abril = competenciasAGerar({ ...base, hojeISO: "2026-04-01" });
  check("abril fecha ciclo (3 meses)", comps(abril) === "2026-04-01", `-> ${comps(abril)}`);

  const maio = competenciasAGerar({ ...base, hojeISO: "2026-05-01" });
  check("maio e mes intermediario, nao cobra", comps(maio) === "", `-> ${comps(maio)}`);

  const junho = competenciasAGerar({ ...base, hojeISO: "2026-06-01" });
  check("junho tambem nao cobra", comps(junho) === "", `-> ${comps(junho)}`);

  const julho = competenciasAGerar({ ...base, hojeISO: "2026-07-01" });
  check("julho fecha ciclo (6 meses)", comps(julho) === "2026-07-01", `-> ${comps(julho)}`);
}

console.log("\n4. Semestral e anual");
{
  const sem = { anchorISO: "2026-02-10", diaVencimento: 10, recorrenciaMeses: 6 };
  check("fevereiro cobra", comps(competenciasAGerar({ ...sem, hojeISO: "2026-02-05" })) === "2026-02-01");
  check("maio nao cobra", comps(competenciasAGerar({ ...sem, hojeISO: "2026-05-05" })) === "");
  check("agosto cobra (6 meses)", comps(competenciasAGerar({ ...sem, hojeISO: "2026-08-05" })) === "2026-08-01");

  const anual = { anchorISO: "2026-03-01", diaVencimento: 1, recorrenciaMeses: 12 };
  check("marco/2026 cobra", comps(competenciasAGerar({ ...anual, hojeISO: "2026-03-01" })) === "2026-03-01");
  check("marco/2027 cobra (12 meses)", comps(competenciasAGerar({ ...anual, hojeISO: "2027-03-01" })) === "2027-03-01");
  check("setembro/2026 nao cobra", comps(competenciasAGerar({ ...anual, hojeISO: "2026-09-01" })) === "");
}

console.log("\n5. Cobranca anterior vencida nao impede a proxima");
{
  // A regra nao recebe nem consulta status de pagamento: julho vencido e
  // irrelevante para a decisao de criar agosto.
  const base = { anchorISO: "2026-01-05", diaVencimento: 5, recorrenciaMeses: 1 };
  const agosto = competenciasAGerar({ ...base, hojeISO: "2026-08-01" });
  check("agosto e criado independente de julho", comps(agosto) === "2026-08-01", `-> ${comps(agosto)}`);
  check("assinatura da funcao nao aceita status de pagamento",
    competenciasAGerar.length === 1);
}

console.log("\n6. Aluno trancado, inativo, cancelado ou sem plano");
{
  const plano = { cobrancaRecorrente: true, valorMensal: 100, planoId: "p1" };
  check("ativa -> elegivel", elegivelParaCobranca({ statusMatricula: "ativa", ...plano }) === true);
  for (const s of ["trancada", "inativa", "cancelada", "pendente"]) {
    check(`${s} -> nao elegivel`,
      elegivelParaCobranca({ statusMatricula: s, ...plano }) === false);
  }
  check("sem plano -> nao elegivel",
    elegivelParaCobranca({ statusMatricula: "ativa", ...plano, planoId: null }) === false);
  check("plano sem cobranca recorrente -> nao elegivel",
    elegivelParaCobranca({ statusMatricula: "ativa", ...plano, cobrancaRecorrente: false }) === false);
  check("plano com valor zero -> nao elegivel",
    elegivelParaCobranca({ statusMatricula: "ativa", ...plano, valorMensal: 0 }) === false);
}

console.log("\n7. Execucao repetida no mesmo dia produz o mesmo plano");
{
  const base = {
    anchorISO: "2026-01-10", diaVencimento: 26,
    recorrenciaMeses: 1, hojeISO: "2026-08-20",
  };
  const a = competenciasAGerar(base);
  const b = competenciasAGerar(base);
  const c = competenciasAGerar(base);
  check("funcao e deterministica", comps(a) === comps(b) && comps(b) === comps(c));
  check("uma competencia por ciclo, sem repeticao",
    a.length === new Set(a.map((x) => x.competencia)).size);
  check("resultado esperado", comps(a) === "2026-08-01", `-> ${comps(a)}`);
  // A nao duplicacao real e garantida pelo indice unico
  // uidx_mensalidade_aluno_comp (aluno_id, competencia).
}

console.log("\n8. Virada de mes e dia de vencimento maior que o mes");
{
  // Vencimento 31: fevereiro precisa cair no ultimo dia.
  const base = { anchorISO: "2026-01-31", diaVencimento: 31, recorrenciaMeses: 1 };
  const fev = competenciasAGerar({ ...base, hojeISO: "2026-02-25" });
  check("fevereiro cai em 28", fev[0]?.vencimento === "2026-02-28", `-> ${fev[0]?.vencimento}`);

  // Janela cruzando o mes: 28/08 com vencimento dia 01 gera setembro tambem.
  const cruza = competenciasAGerar({
    anchorISO: "2026-01-01", diaVencimento: 1, recorrenciaMeses: 1, hojeISO: "2026-08-28",
  });
  check("janela cruza o mes e alcanca setembro",
    comps(cruza).includes("2026-09-01"), `-> ${comps(cruza)}`);
}

console.log("\n9. Antes do inicio do ciclo");
{
  const futuro = competenciasAGerar({
    anchorISO: "2026-12-01", diaVencimento: 5, recorrenciaMeses: 1, hojeISO: "2026-08-01",
  });
  check("aluno matriculado no futuro nao gera nada", comps(futuro) === "", `-> ${comps(futuro)}`);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
