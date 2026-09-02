/**
 * Testes de lib/permissoes.ts (Fase 10 — Papéis e permissões).
 *
 * Roda com: npm run test:permissoes
 * Mesmo esquema dos outros testes do projeto: compila lib/permissoes.ts +
 * lib/types.ts para .test-build-perm/ e roda com Node puro, sem framework.
 */
import {
  podeAcessar,
  podeGerenciarTreinos,
  removeriaUltimoDono,
} from "../.test-build-perm/permissoes.js";

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

const TODAS_SECOES = [
  "dashboard", "recepcao", "alunos", "treinos", "funcionarios", "loja",
  "financeiro", "feedback", "atendimento", "relatorios", "retencao",
  "configuracoes", "integracoes", "equipe",
];

console.log("\n1. Dono acessa toda a área administrativa");
{
  for (const secao of TODAS_SECOES) {
    check(`dono -> ${secao}`, podeAcessar("dono", secao) === true);
  }
}

console.log("\n2. Gerente: operação e relatórios, nunca propriedade/config crítica");
{
  for (const secao of ["dashboard", "recepcao", "alunos", "treinos", "loja", "funcionarios", "retencao", "relatorios", "feedback", "atendimento"]) {
    check(`gerente -> ${secao} liberado`, podeAcessar("gerente", secao) === true);
  }
  for (const secao of ["financeiro", "configuracoes", "integracoes", "equipe"]) {
    check(`gerente -> ${secao} bloqueado`, podeAcessar("gerente", secao) === false);
  }
}

console.log("\n3. Recepcionista: recepção e alunos, sem DRE/config/equipe");
{
  // Recepção atende aluno o dia inteiro: "atendimento" é o trabalho dela.
  for (const secao of ["dashboard", "recepcao", "alunos", "treinos", "loja", "atendimento"]) {
    check(`recepcao -> ${secao} liberado`, podeAcessar("recepcao", secao) === true);
  }
  for (const secao of ["financeiro", "configuracoes", "integracoes", "equipe", "funcionarios", "retencao", "relatorios"]) {
    check(`recepcao -> ${secao} bloqueado`, podeAcessar("recepcao", secao) === false);
  }
}

console.log("\n4. Professor (instrutor): treinos e alunos, sem financeiro/config");
{
  for (const secao of ["dashboard", "recepcao", "alunos", "treinos"]) {
    check(`instrutor -> ${secao} liberado`, podeAcessar("instrutor", secao) === true);
  }
  for (const secao of ["financeiro", "configuracoes", "integracoes", "equipe", "funcionarios", "retencao", "relatorios", "loja", "atendimento", "feedback"]) {
    check(`instrutor -> ${secao} bloqueado`, podeAcessar("instrutor", secao) === false);
  }
}

console.log("\n5. removeriaUltimoDono — guarda do último proprietário ativo");
{
  check(
    "quem não é dono nunca afeta a contagem",
    removeriaUltimoDono("gerente", null, 1) === false
  );
  check(
    "trocar dono por dono não é rebaixamento",
    removeriaUltimoDono("dono", "dono", 1) === false
  );
  check(
    "remover o único dono é bloqueado",
    removeriaUltimoDono("dono", null, 1) === true
  );
  check(
    "remover um dono quando há outro é permitido",
    removeriaUltimoDono("dono", null, 2) === false
  );
  check(
    "rebaixar o único dono para gerente é bloqueado",
    removeriaUltimoDono("dono", "gerente", 1) === true
  );
  check(
    "rebaixar um dono para gerente quando há outro dono é permitido",
    removeriaUltimoDono("dono", "gerente", 2) === false
  );
}

console.log("\n6. podeGerenciarTreinos — gerenciar treinos (atribuir/compartilhar/visibilidade)");
{
  // Desde o pedido do cliente (02/09/2026) a recepção também gerencia treinos:
  // dono, gerente, instrutor E recepção — todo papel que acessa a seção.
  for (const papel of ["dono", "gerente", "instrutor", "recepcao"]) {
    check(`${papel} pode gerenciar treinos`, podeGerenciarTreinos(papel) === true);
  }
  check("recepcao vê a seção de treinos", podeAcessar("recepcao", "treinos") === true);
  check(
    "recepcao gerencia treinos (atribui/compartilha) como a equipe técnica",
    podeGerenciarTreinos("recepcao") === true
  );
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
