/**
 * Testes de lib/convites.ts — geração e hash do token de convite.
 * Roda com: npm run test:convites
 *
 * Cobre o que sustenta a segurança do convite sem precisar de banco: o token é
 * imprevisível e único, o hash é determinístico e some com o token bruto, o
 * formato é validado antes de qualquer consulta, e a expiração respeita limites.
 */
import {
  TOKEN_BYTES,
  gerarTokenConvite,
  hashTokenConvite,
  tokenTemFormatoValido,
  normalizarExpiracaoDias,
  calcularExpiracao,
  montarLinkConvite,
  CONVITE_EXPIRACAO_DIAS_MIN,
  CONVITE_EXPIRACAO_DIAS_MAX,
  CONVITE_EXPIRACAO_DIAS_PADRAO,
} from "../.test-build-convites/convites.js";

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

console.log("\n1. gerarTokenConvite — imprevisível e único");
{
  const a = gerarTokenConvite();
  const b = gerarTokenConvite();
  check("dois tokens são diferentes", a !== b);
  check("é base64url (sem +, /, =)", !/[+/=]/.test(a));
  check("tem tamanho coerente com 32 bytes", a.length >= 40 && a.length <= 64, `len=${a.length}`);
  check("TOKEN_BYTES é 32 (256 bits)", TOKEN_BYTES === 32);

  // Amostra de unicidade: 1000 tokens, nenhum repetido.
  const set = new Set();
  for (let i = 0; i < 1000; i++) set.add(gerarTokenConvite());
  check("1000 tokens sem colisão", set.size === 1000);
}

console.log("\n2. hashTokenConvite — determinístico e não reversível ao bruto");
{
  const t = gerarTokenConvite();
  const h1 = hashTokenConvite(t);
  const h2 = hashTokenConvite(t);
  check("mesmo token -> mesmo hash", h1 === h2);
  check("hash é hex de 64 chars (sha-256)", /^[0-9a-f]{64}$/.test(h1));
  check("hash != token bruto", h1 !== t);
  check("tokens diferentes -> hashes diferentes", hashTokenConvite("aaaa") !== hashTokenConvite("aaab"));
  // Valor conhecido de sha-256("abc") — garante que é sha-256 de verdade.
  check(
    'sha-256("abc") confere',
    hashTokenConvite("abc") ===
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
}

console.log("\n3. tokenTemFormatoValido — rejeita lixo antes de consultar");
{
  check("token real é válido", tokenTemFormatoValido(gerarTokenConvite()));
  check("vazio -> inválido", !tokenTemFormatoValido(""));
  check("null -> inválido", !tokenTemFormatoValido(null));
  check("com espaço -> inválido", !tokenTemFormatoValido("abc def"));
  check("com barra -> inválido", !tokenTemFormatoValido("abc/def"));
  check("curto demais -> inválido", !tokenTemFormatoValido("abc"));
  check("caractere proibido (=) -> inválido", !tokenTemFormatoValido("A".repeat(42) + "="));
}

console.log("\n4. normalizarExpiracaoDias / calcularExpiracao — limites seguros");
{
  check("padrão quando NaN", normalizarExpiracaoDias("x") === CONVITE_EXPIRACAO_DIAS_PADRAO);
  check("clampa abaixo do mínimo", normalizarExpiracaoDias(0) === CONVITE_EXPIRACAO_DIAS_MIN);
  check("clampa acima do máximo", normalizarExpiracaoDias(999) === CONVITE_EXPIRACAO_DIAS_MAX);
  check("valor válido mantém", normalizarExpiracaoDias(3) === 3);

  const agora = new Date("2026-01-01T00:00:00.000Z");
  const exp = calcularExpiracao(2, agora);
  check("expiração soma os dias", exp === "2026-01-03T00:00:00.000Z", exp);
}

console.log("\n5. montarLinkConvite — token no path, sem barra dupla");
{
  const l = montarLinkConvite("https://gestacad.com.br/", "tokenAbC-_123");
  check("usa /ativar/<token>", l === "https://gestacad.com.br/ativar/tokenAbC-_123", l);
  check("sem barra dupla no meio", !l.slice(8).includes("//"));
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
if (falhou > 0) process.exit(1);
