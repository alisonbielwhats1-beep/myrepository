/**
 * Testes de lib/validacoes.ts (Fase 11 — validação do cadastro do aluno).
 *
 * Roda com: npm run test:validacoes
 * Mesmo esquema dos outros testes do projeto: compila lib/validacoes.ts para
 * .test-build-val/ e roda com Node puro, sem framework.
 */
import { normalizarCpf, validarUrl, validarSlug } from "../.test-build-val/validacoes.js";

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

console.log("\n1. normalizarCpf — valores inválidos são rejeitados");
{
  check("vazio -> null", normalizarCpf("") === null);
  check("null -> null", normalizarCpf(null) === null);
  check("undefined -> null", normalizarCpf(undefined) === null);
  check("menos de 11 digitos -> null", normalizarCpf("123.456.789") === null);
  check("mais de 11 digitos -> null", normalizarCpf("123456789012") === null);
  check("letras -> null (sem digito nenhum)", normalizarCpf("abc") === null);
}

console.log("\n2. normalizarCpf — formatos válidos aceitos e normalizados");
{
  check(
    "com máscara -> só dígitos",
    normalizarCpf("123.456.789-01") === "12345678901",
    `-> ${normalizarCpf("123.456.789-01")}`
  );
  check("só dígitos -> mantém", normalizarCpf("12345678901") === "12345678901");
  check(
    "com espaços/letras junto -> extrai os 11 dígitos",
    normalizarCpf(" cpf 123.456.789-01 ") === "12345678901"
  );
}

console.log("\n3. validarUrl — protocolo e host");
{
  check("vazio -> null", validarUrl("") === null);
  check("http (não https) -> null", validarUrl("http://exemplo.com/foto.png") === null);
  check("javascript: -> null", validarUrl("javascript:alert(1)") === null);
  check("data: -> null", validarUrl("data:image/png;base64,abc") === null);
  check("relativa -> null", validarUrl("/foto.png") === null);
  check("host curto demais -> null", validarUrl("https://a/foto.png") === null);
  check(
    "https válida -> mantém",
    validarUrl("https://exemplo.com/foto.png") === "https://exemplo.com/foto.png"
  );
}

console.log("\n4. validarSlug — formato do slug da academia");
{
  check("minusculas e numeros -> valido", validarSlug("academia-123") === true);
  check("maiusculas -> invalido", validarSlug("Academia") === false);
  check("comeca com hifen -> invalido", validarSlug("-academia") === false);
  check("termina com hifen -> invalido", validarSlug("academia-") === false);
  check("muito curto -> invalido", validarSlug("ab") === false);
  check("espaco -> invalido", validarSlug("academia legal") === false);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
