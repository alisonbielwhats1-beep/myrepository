/**
 * Testes de lib/totalpass-webhook.ts (leitura do webhook oficial da TotalPass).
 *
 * Roda com: npm run test:totalpass
 * Mesmo esquema dos outros testes do projeto: compila para .test-build-totalpass/
 * e roda com Node puro, sem framework.
 */
import {
  endpointDeValidacaoConfiavel,
  lerCheckinTotalPass,
  unidadeConfere,
  chaveUnidadeValida,
} from "../.test-build-totalpass/totalpass-webhook.js";

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

// Payload de exemplo da documentação oficial (dev.totalpass.com → Validate Checkin).
const exemplo = {
  type: "CHECK_IN_CREATED",
  endpoint:
    "https://admin.staging.totalpass.com/api/v1/webhook_confirmations/TXIefq1R0-w59n6XLaMhR425lS0olXdTSnQ0qJUNZpnF2GGyUWcjrw==",
  check_in: {
    started_at: "2024-08-07T17:54:16.271-03:00",
    plan_code: "59TADO9F",
    expires_at: "2024-08-07T19:24:16.271-03:00",
  },
  place: { place: "5e701467-4d80-40a4-b78a-00490a6feb9b", name: "Batatinha", code: "59TADO9F" },
  user: {
    name: "Cleveland Wolf",
    email: "x@y.com",
    phone: "6399907-8947",
    document_number: "668.445.636-80",
    document_type: "cpf",
    code: "EQ2B3FBK",
  },
};

console.log("\n1. Payload oficial é lido corretamente");
{
  const r = lerCheckinTotalPass(exemplo);
  check("tipo checkin", r.tipo === "checkin");
  if (r.tipo === "checkin") {
    check("cpf só dígitos", r.checkin.cpf === "66844563680");
    check("nome", r.checkin.nomeUsuario === "Cleveland Wolf");
    check("código da unidade", r.checkin.codigoUnidade === "59TADO9F");
    check("uuid da unidade", r.checkin.placeUuid === "5e701467-4d80-40a4-b78a-00490a6feb9b");
    check(
      "eventoId = token do link",
      r.checkin.eventoId === "TXIefq1R0-w59n6XLaMhR425lS0olXdTSnQ0qJUNZpnF2GGyUWcjrw=="
    );
    check("endpoint preservado", r.checkin.endpoint.startsWith("https://admin.staging.totalpass.com/"));
  }
}

console.log("\n2. Eventos que não são check-in são ignorados, lixo é inválido");
{
  check("outro tipo -> ignorar", lerCheckinTotalPass({ ...exemplo, type: "OTHER" }).tipo === "ignorar");
  check("sem corpo -> ignorar", lerCheckinTotalPass(null).tipo === "ignorar");
  check("array -> ignorar", lerCheckinTotalPass([]).tipo === "ignorar");
  check(
    "sem endpoint -> invalido",
    lerCheckinTotalPass({ ...exemplo, endpoint: undefined }).tipo === "invalido"
  );
}

console.log("\n3. Link de validação só é aceito se for da TotalPass (anti-SSRF)");
{
  const ok = endpointDeValidacaoConfiavel;
  check("admin.totalpass.com", ok("https://admin.totalpass.com/api/v1/webhook_confirmations/abc") !== null);
  check("staging", ok("https://admin.staging.totalpass.com/api/v1/webhook_confirmations/abc") !== null);
  check("http recusado", ok("http://admin.totalpass.com/api/v1/webhook_confirmations/abc") === null);
  check("host alheio", ok("https://evil.com/api/v1/webhook_confirmations/abc") === null);
  check("sufixo enganoso", ok("https://totalpass.com.evil.com/api/v1/webhook_confirmations/abc") === null);
  check("prefixo enganoso", ok("https://eviltotalpass.com/api/v1/webhook_confirmations/abc") === null);
  check("credencial na URL", ok("https://a:b@admin.totalpass.com/api/v1/webhook_confirmations/abc") === null);
  check("porta", ok("https://admin.totalpass.com:8443/api/v1/webhook_confirmations/abc") === null);
  check("caminho errado", ok("https://admin.totalpass.com/api/v1/outra/abc") === null);
  check("sem token", ok("https://admin.totalpass.com/api/v1/webhook_confirmations/") === null);
  check("token com barra", ok("https://admin.totalpass.com/api/v1/webhook_confirmations/a/b") === null);
  check("não-string", ok(123) === null);
}

console.log("\n4. Documento que não é CPF não vira CPF");
{
  const r = lerCheckinTotalPass({ ...exemplo, user: { ...exemplo.user, document_type: "passport" } });
  check("passaporte -> cpf null", r.tipo === "checkin" && r.checkin.cpf === null);
  const r2 = lerCheckinTotalPass({ ...exemplo, user: { ...exemplo.user, document_number: "123" } });
  check("curto -> cpf null", r2.tipo === "checkin" && r2.checkin.cpf === null);
}

console.log("\n5. Conferência da unidade");
{
  const c = { codigoUnidade: "59TADO9F", placeUuid: "5e701467-4d80-40a4-b78a-00490a6feb9b" };
  check("sem nada guardado aceita", unidadeConfere(c, { codigo_unidade: null, place_uuid: null }));
  check("código igual (caixa)", unidadeConfere(c, { codigo_unidade: "59tado9f", place_uuid: null }));
  check("uuid igual", unidadeConfere(c, { codigo_unidade: null, place_uuid: c.placeUuid.toUpperCase() }));
  check("código diferente recusa", !unidadeConfere(c, { codigo_unidade: "XXXXXXXX", place_uuid: null }));
}

console.log("\n6. Formato da chave da unidade");
{
  check("uuid", chaveUnidadeValida("c8f928a1-302c-4776-91d9-84063a38b68b"));
  check("curta", !chaveUnidadeValida("abc"));
  check("com espaço", !chaveUnidadeValida("abc def ghi"));
}

console.log(`\n${passou} ok, ${falhou} falha(s)`);
process.exit(falhou > 0 ? 1 : 0);
