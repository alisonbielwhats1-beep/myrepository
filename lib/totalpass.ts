// Cliente da API oficial de Validação de Check-in da TotalPass
// (dev.totalpass.com). Server-only: usa a partner_api_key do GestAcad, que
// fica SÓ em variável de ambiente — nunca no banco, nunca no navegador, nunca
// pedida à academia (regra da própria TotalPass).
//
// Variáveis:
//   TOTALPASS_PARTNER_API_KEY  — chave do GestAcad como integrador, entregue
//                                pela TotalPass após o Termo de Adesão.
//   TOTALPASS_API_URL          — opcional; padrão https://gym-service-api.totalpass.com
//                                (homologação: https://gym-service-api.staging.totalpass.com)

const API_PADRAO = "https://gym-service-api.totalpass.com";
const TEMPO_LIMITE_MS = 10_000;

export type ErroTotalPass = {
  erro: string;
  /** Código HTTP devolvido pela TotalPass, quando houve resposta. */
  status?: number;
};

export type SessaoTotalPass = {
  token: string;
  placeNome: string | null;
  partnerNome: string | null;
};

export function partnerKeyConfigurada(): boolean {
  return Boolean(process.env.TOTALPASS_PARTNER_API_KEY?.trim());
}

function baseApi(): string {
  return (process.env.TOTALPASS_API_URL?.trim() || API_PADRAO).replace(/\/+$/, "");
}

async function chamar(
  url: string,
  init: RequestInit & { json?: unknown; jwt?: string }
): Promise<{ status: number; corpo: unknown } | ErroTotalPass> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  if (init.jwt) headers.Authorization = `Bearer ${init.jwt}`;
  try {
    const res = await fetch(url, {
      method: init.method,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    const bruto = await res.text();
    let corpo: unknown = bruto;
    try {
      corpo = bruto ? JSON.parse(bruto) : null;
    } catch {
      /* resposta não-JSON: fica o texto */
    }
    return { status: res.status, corpo };
  } catch (e) {
    const tempo = e instanceof Error && e.name === "TimeoutError";
    return {
      erro: tempo
        ? "A TotalPass demorou demais para responder. Tente de novo em instantes."
        : "Não foi possível falar com a TotalPass agora. Tente de novo em instantes.",
    };
  }
}

function eErro(r: unknown): r is ErroTotalPass {
  return typeof r === "object" && r !== null && "erro" in r;
}

/** POST /partner/auth — valida as duas chaves e devolve o JWT (24 h). */
export async function autenticarUnidade(
  placeApiKey: string
): Promise<SessaoTotalPass | ErroTotalPass> {
  const partnerApiKey = process.env.TOTALPASS_PARTNER_API_KEY?.trim();
  if (!partnerApiKey) {
    return {
      erro:
        "O GestAcad ainda não recebeu da TotalPass a credencial de integrador. A conexão fica disponível assim que ela for configurada.",
    };
  }
  const r = await chamar(`${baseApi()}/partner/auth`, {
    method: "POST",
    json: { place_api_key: placeApiKey, partner_api_key: partnerApiKey },
  });
  if (eErro(r)) return r;
  if (r.status === 401 || r.status === 400) {
    return {
      status: r.status,
      erro:
        "A TotalPass recusou a chave. Confira se ela foi gerada no Portal da TotalPass com o GestAcad selecionado como sistema (uma chave gerada para outro sistema não funciona aqui).",
    };
  }
  const corpo = (r.corpo ?? {}) as Record<string, unknown>;
  const token = typeof corpo.token === "string" ? corpo.token : null;
  if (r.status >= 300 || !token) {
    return { status: r.status, erro: `A TotalPass respondeu de forma inesperada (HTTP ${r.status}).` };
  }
  const nome = (v: unknown) =>
    v && typeof v === "object" && typeof (v as { name?: unknown }).name === "string"
      ? ((v as { name: string }).name)
      : null;
  return { token, placeNome: nome(corpo.place), partnerNome: nome(corpo.partner) };
}

/** GET /partner/webhook/get — URLs de webhook cadastradas para esta unidade. */
export async function listarWebhooks(
  jwt: string
): Promise<{ webhooks: { url: string; tipo: string }[] } | ErroTotalPass> {
  const r = await chamar(`${baseApi()}/partner/webhook/get`, { method: "GET", jwt });
  if (eErro(r)) return r;
  if (r.status === 404) return { webhooks: [] };
  if (r.status >= 300) {
    return { status: r.status, erro: `Falha ao consultar o webhook na TotalPass (HTTP ${r.status}).` };
  }
  const lista = (r.corpo as { webhooks?: unknown })?.webhooks;
  const webhooks = Array.isArray(lista)
    ? lista
        .map((w) => w as { webhook_url?: unknown; webhook_type?: unknown })
        .filter((w) => typeof w.webhook_url === "string")
        .map((w) => ({ url: String(w.webhook_url), tipo: String(w.webhook_type ?? "") }))
    : [];
  return { webhooks };
}

/**
 * Garante que o webhook de CHECKIN desta unidade aponta para `url`: cria se
 * não existe, atualiza se aponta para outro lugar, não mexe se já está certo.
 */
export async function garantirWebhook(
  jwt: string,
  url: string
): Promise<{ ok: true } | ErroTotalPass> {
  const atual = await listarWebhooks(jwt);
  if (eErro(atual)) return atual;
  const checkin = atual.webhooks.filter((w) => w.tipo.toUpperCase() === "CHECKIN");
  if (checkin.some((w) => w.url === url)) return { ok: true };

  const existe = checkin.length > 0;
  const r = await chamar(
    `${baseApi()}/partner/webhook/${existe ? "update" : "create"}`,
    { method: existe ? "PUT" : "POST", jwt, json: { webhook_url: url, webhook_type: "CHECKIN" } }
  );
  if (eErro(r)) return r;
  if (r.status >= 300) {
    return { status: r.status, erro: `A TotalPass não aceitou o cadastro do webhook (HTTP ${r.status}).` };
  }
  return { ok: true };
}

/** DELETE /partner/webhook/delete/CHECKIN — para de receber check-ins. */
export async function removerWebhook(jwt: string): Promise<{ ok: true } | ErroTotalPass> {
  const r = await chamar(`${baseApi()}/partner/webhook/delete/CHECKIN`, {
    method: "DELETE",
    jwt,
  });
  if (eErro(r)) return r;
  if (r.status >= 300 && r.status !== 404) {
    return { status: r.status, erro: `Falha ao remover o webhook na TotalPass (HTTP ${r.status}).` };
  }
  return { ok: true };
}

export type ResultadoValidacao =
  | { resultado: "validado" }
  | { resultado: "indisponivel"; detalhe: string } // 422: já validado no portal ou expirado
  | { resultado: "falhou"; detalhe: string };

/**
 * Libera a entrada: POST no link exclusivo que veio no webhook. O link já foi
 * conferido por `endpointDeValidacaoConfiavel` antes de chegar aqui.
 */
export async function validarCheckin(endpoint: string): Promise<ResultadoValidacao> {
  const r = await chamar(endpoint, { method: "POST" });
  if (eErro(r)) return { resultado: "falhou", detalhe: r.erro };
  if (r.status >= 200 && r.status < 300) return { resultado: "validado" };
  if (r.status === 422) {
    const msg = JSON.stringify(r.corpo ?? "");
    const expirado = msg.includes("expired");
    return {
      resultado: "indisponivel",
      detalhe: expirado
        ? "check-in expirado na TotalPass"
        : "check-in já validado ou indisponível na TotalPass",
    };
  }
  if (r.status === 404) return { resultado: "falhou", detalhe: "check-in não encontrado na TotalPass" };
  return { resultado: "falhou", detalhe: `TotalPass respondeu HTTP ${r.status}` };
}
