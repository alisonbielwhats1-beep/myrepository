/**
 * Testes da área do aluno sem login (Fase 12): isolamento entre alunos,
 * classificação de mensalidade, frequência (negado nunca conta), avatar sem
 * foto e validação da edição de foto.
 *
 * Roda com: npm run test:aluno
 * lib/aluno-classificacao.ts importa lib/utils.ts em tempo de execução
 * (hojeSaoPaulo), por isso usa CommonJS aqui — mesmo esquema de
 * test:financeiro/test:cobrancas.
 */
const {
  classificarMensalidade,
  contarAcessosDesde,
  fichaPertenceAoSlug,
  frequenciaSemanaEMes,
  iniciaisNome,
  temFotoValida,
  ultimoAcessoEfetivo,
} = require("../.test-build-aluno/aluno-classificacao.js");
const { validarUrl } = require("../.test-build-aluno/validacoes.js");
const { hojeSaoPaulo } = require("../.test-build-aluno/utils.js");

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
function isoHaDias(n) {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

console.log("\n1. Isolamento entre alunos e academias (fichaPertenceAoSlug)");
{
  const ficha = { academia: { slug_url: "academia-a" } };
  check("mesmo slug -> pertence", fichaPertenceAoSlug(ficha, "academia-a") === true);
  check(
    "slug de outra academia (link adulterado) -> NÃO pertence",
    fichaPertenceAoSlug(ficha, "academia-b") === false
  );
  check("ficha nula (aluno inexistente) -> NÃO pertence", fichaPertenceAoSlug(null, "academia-a") === false);
  check(
    "slug vazio/forjado não engana a checagem",
    fichaPertenceAoSlug(ficha, "") === false
  );
}

console.log("\n2. Classificação das mensalidades");
{
  check(
    "pendente com vencimento futuro -> pendente",
    classificarMensalidade({ status: "pendente", data: haDias(-5) }, hoje) === "pendente"
  );
  check(
    "pendente vencendo hoje -> pendente (não é atraso)",
    classificarMensalidade({ status: "pendente", data: hoje }, hoje) === "pendente"
  );
  check(
    "pendente com vencimento passado -> vencida",
    classificarMensalidade({ status: "pendente", data: haDias(3) }, hoje) === "vencida"
  );
  check(
    "status pago -> paga (mesmo com data antiga)",
    classificarMensalidade({ status: "pago", data: haDias(60) }, hoje) === "paga"
  );
  check(
    "status cancelada -> cancelada",
    classificarMensalidade({ status: "cancelada", data: haDias(3) }, hoje) === "cancelada"
  );
}

console.log("\n3. Frequência: acesso negado nunca conta como presença");
{
  const acessos = [
    { data_hora_entrada: isoHaDias(1), status_liberacao: "liberado" },
    { data_hora_entrada: isoHaDias(2), status_liberacao: "alerta" },
    { data_hora_entrada: isoHaDias(0), status_liberacao: "negado" },
    { data_hora_entrada: isoHaDias(0), status_liberacao: "pendente" },
  ];

  check(
    "contarAcessosDesde ignora negado e pendente (só 2 efetivos)",
    contarAcessosDesde(acessos, haDias(10)) === 2
  );

  const { semana } = frequenciaSemanaEMes(acessos, hoje);
  check("frequência da semana ignora negado (2, não 4)", semana === 2, `-> ${semana}`);

  const ultimo = ultimoAcessoEfetivo(acessos);
  check(
    "último acesso efetivo é o liberado de ontem, não o negado de hoje",
    ultimo === isoHaDias(1),
    `-> ${ultimo}`
  );

  const soNegado = [{ data_hora_entrada: isoHaDias(0), status_liberacao: "negado" }];
  check(
    "aluno só com tentativas negadas -> último acesso null (nunca acessou de fato)",
    ultimoAcessoEfetivo(soNegado) === null
  );
}

console.log("\n4. Estados vazios");
{
  check("sem acessos -> contagem 0", contarAcessosDesde([], hoje) === 0);
  check("sem acessos -> último acesso null", ultimoAcessoEfetivo([]) === null);
  const { semana, mes } = frequenciaSemanaEMes([], hoje);
  check("sem acessos -> semana e mês 0", semana === 0 && mes === 0);
}

console.log("\n5. Perfil sem foto (avatar padrão)");
{
  check("URL nula -> sem foto válida", temFotoValida(null) === false);
  check("string vazia -> sem foto válida", temFotoValida("   ") === false);
  check("URL preenchida -> foto válida", temFotoValida("https://exemplo.com/a.jpg") === true);
  check("iniciais de nome completo", iniciaisNome("Maria Silva") === "MS");
  check("iniciais de nome único", iniciaisNome("Maria") === "M");
  check("iniciais de nome vazio não quebra", iniciaisNome("   ") === "?");
}

console.log("\n6. Validação da edição de foto de perfil");
{
  check("URL https válida é aceita", validarUrl("https://exemplo.com/foto.jpg") === "https://exemplo.com/foto.jpg");
  check("URL http (sem https) é rejeitada", validarUrl("http://exemplo.com/foto.jpg") === null);
  check("texto que não é URL é rejeitado", validarUrl("nao-e-url") === null);
  check("string vazia (limpar foto) vira null, não erro", validarUrl("") === null);
  check("javascript: não é aceito como URL de foto", validarUrl("javascript:alert(1)") === null);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
