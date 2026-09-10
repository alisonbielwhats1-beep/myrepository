/**
 * Testes de lib/planos.ts — a tabela de preços do SaaS.
 *
 * Existe por causa de um defeito real (achado A1 da auditoria de 10/09/2026):
 * `profissional` e `premium` tinham listas de recursos IDÊNTICAS. Quem pagava
 * R$ 99 recebia exatamente o que R$ 59,90 entregava, e o botão de upgrade não
 * tinha para onde levar — enquanto a tela de plano vendia "Integrações Gympass
 * e TotalPass" como exclusivo do Premium.
 *
 * O teste central é "todo plano pago entrega algo a mais que o anterior".
 * Nenhum comentário impede a regressão; esta asserção impede.
 *
 * Roda com: npm run test:planos
 */
import {
  PLANOS_SAAS,
  RECURSOS_VENDAVEIS,
  planoMinimo,
  planoPodeAcessar,
  recursosExclusivos,
} from "../.test-build-planos/planos.js";

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

const ORDEM = ["basico", "profissional", "premium"];

console.log("\n1. Todo plano pago entrega algo a mais que o anterior (defeito A1)");
{
  for (const plano of ["profissional", "premium"]) {
    const exclusivos = recursosExclusivos(plano);
    check(
      `${plano} tem recurso exclusivo`,
      exclusivos.length > 0,
      `(nenhum — ninguém tem motivo para pagar por ${plano})`
    );
  }
  check(
    "premium entrega integracoes",
    recursosExclusivos("premium").includes("integracoes")
  );
  check(
    "premium entrega intelligence",
    recursosExclusivos("premium").includes("intelligence")
  );
  check(
    "profissional NÃO entrega integracoes",
    !planoPodeAcessar("profissional", "integracoes")
  );
  check(
    "profissional NÃO entrega intelligence",
    !planoPodeAcessar("profissional", "intelligence")
  );
}

console.log("\n2. Os planos são cumulativos — subir nunca tira nada");
{
  for (let i = 1; i < ORDEM.length; i++) {
    const menor = ORDEM[i - 1];
    const maior = ORDEM[i];
    const perdidos = RECURSOS_VENDAVEIS.map((r) => r.recurso).filter(
      (r) => planoPodeAcessar(menor, r) && !planoPodeAcessar(maior, r)
    );
    check(
      `${maior} mantém tudo de ${menor}`,
      perdidos.length === 0,
      `(perderia: ${perdidos.join(", ")})`
    );
  }
}

console.log("\n3. A vitrine não promete o que o código não entrega");
{
  // Cada linha da tela de plano precisa existir de fato em algum plano —
  // senão a promessa é vendida e nunca cumprida (o defeito original).
  for (const { recurso, label } of RECURSOS_VENDAVEIS) {
    const min = planoMinimo(recurso);
    check(
      `"${label}" existe a partir de ${min}`,
      planoPodeAcessar(min, recurso),
      "(prometido na vitrine, ausente no código)"
    );
  }
  check(
    "integracoes é vendido como premium",
    planoMinimo("integracoes") === "premium"
  );
  check(
    "operação da academia continua no profissional",
    ["financeiro", "loja", "relatorios", "equipe", "retencao"].every(
      (r) => planoMinimo(r) === "profissional"
    )
  );
  check(
    "o básico já toca a academia (alunos e treinos)",
    planoPodeAcessar("basico", "alunos") && planoPodeAcessar("basico", "treinos")
  );
}

console.log("\n4. Preço acompanha a entrega");
{
  const preco = (v) => PLANOS_SAAS.find((p) => p.value === v)?.preco ?? 0;
  for (let i = 1; i < ORDEM.length; i++) {
    check(
      `${ORDEM[i]} custa mais que ${ORDEM[i - 1]}`,
      preco(ORDEM[i]) > preco(ORDEM[i - 1])
    );
  }
  check("os três planos têm preço", ORDEM.every((p) => preco(p) > 0));
}

console.log("\n5. Recurso desconhecido falha fechado");
{
  check(
    "recurso inexistente não é liberado em nenhum plano",
    ORDEM.every((p) => !planoPodeAcessar(p, "recurso_que_nao_existe"))
  );
  check(
    "planoMinimo de recurso inexistente devolve o plano mais alto",
    planoMinimo("recurso_que_nao_existe") === "premium"
  );
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
