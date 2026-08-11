/**
 * Testes de lib/senha.ts — regras dos dois fluxos de troca de senha
 * (redefinição por e-mail e alteração com o usuário logado).
 *
 * Roda com: npm run test:senha
 *
 * São regras que o cliente encosta o tempo todo (senha curta, confirmação
 * trocada, repetir a mesma). Cobri-las sem mock só é possível porque a lógica
 * mora numa função pura, separada da Server Action que fala com o Supabase.
 */
import {
  SENHA_MIN,
  validarNovaSenha,
  validarAlteracaoSenha,
} from "../.test-build-senha/senha.js";

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

console.log("\n1. validarNovaSenha — redefinição por e-mail");
{
  check("senha válida e confirmada -> null (ok)", validarNovaSenha("segredo123", "segredo123") === null);
  check("com 8 exatos -> ok", validarNovaSenha("12345678", "12345678") === null);
  check("curta demais -> erro de tamanho", (validarNovaSenha("1234567", "1234567") ?? "").includes("pelo menos"));
  check("confirmação diferente -> erro", validarNovaSenha("segredo123", "outra123") === "As senhas não coincidem.");
  check("vazia -> erro de tamanho", (validarNovaSenha("", "") ?? "").includes("pelo menos"));
  check(`o mínimo é ${SENHA_MIN}`, SENHA_MIN === 8);
}

console.log("\n2. validarAlteracaoSenha — troca com usuário logado");
{
  check("tudo certo -> null (ok)", validarAlteracaoSenha("antiga123", "novaSenha1", "novaSenha1") === null);
  check("sem senha atual -> exige a atual", validarAlteracaoSenha("", "novaSenha1", "novaSenha1") === "Informe a senha atual.");
  check("nova curta -> erro de tamanho", (validarAlteracaoSenha("antiga123", "curta", "curta") ?? "").includes("pelo menos"));
  check("confirmação não bate -> erro", validarAlteracaoSenha("antiga123", "novaSenha1", "novaSenha2") === "A confirmação não coincide com a nova senha.");
  check("nova igual à atual -> erro", validarAlteracaoSenha("igual1234", "igual1234", "igual1234") === "A nova senha precisa ser diferente da atual.");
}

console.log("\n3. Nenhuma mensagem vaza jargão técnico");
{
  const casos = [
    validarNovaSenha("1", "1"),
    validarNovaSenha("segredo123", "x"),
    validarAlteracaoSenha("", "a", "a"),
    validarAlteracaoSenha("antiga123", "novaSenha1", "z"),
    validarAlteracaoSenha("igual1234", "igual1234", "igual1234"),
  ].filter(Boolean);
  const jargao = /supabase|auth|token|constraint|null|undefined/i;
  check("todas as mensagens em português claro", casos.every((m) => !jargao.test(m)), `-> ${casos.join(" | ")}`);
  check("toda mensagem termina em ponto", casos.every((m) => m.trim().endsWith(".")));
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
