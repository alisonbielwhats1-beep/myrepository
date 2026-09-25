// Leitura do webhook de check-in da TotalPass — PURO (sem I/O, sem Next), para
// ser testado isolado (`npm run test:totalpass`).
//
// Formato oficial (dev.totalpass.com → "Validate Checkin"):
// {
//   "type": "CHECK_IN_CREATED",
//   "endpoint": "https://admin.totalpass.com/api/v1/webhook_confirmations/<TOKEN>",
//   "check_in": { "started_at": "...", "plan_code": "...", "expires_at": "..." },
//   "place":    { "place": "<uuid>", "name": "...", "code": "59TADO9F" },
//   "user":     { "name": "...", "email": "...", "phone": "...",
//                 "document_number": "66844563680", "document_type": "cpf", "code": "..." }
// }
// Para liberar a entrada, o ERP faz um POST no `endpoint` (prazo: 90 min).

export type CheckinTotalPass = {
  /** Token do link de validação — único por check-in; vira o id do evento. */
  eventoId: string;
  /** Link de validação, já conferido como sendo da TotalPass. */
  endpoint: string;
  cpf: string | null;
  nomeUsuario: string | null;
  codigoUnidade: string | null;
  placeUuid: string | null;
  expiraEm: string | null;
};

export type LeituraCheckin =
  | { tipo: "checkin"; checkin: CheckinTotalPass }
  | { tipo: "ignorar"; motivo: string }
  | { tipo: "invalido"; motivo: string };

const CAMINHO_VALIDACAO = "/api/v1/webhook_confirmations/";

/**
 * O link de validação vem no corpo do webhook, então é dado de fora: só é
 * aceito se for HTTPS num host da TotalPass e no caminho oficial. Sem isso,
 * quem descobrisse a URL do webhook poderia fazer o nosso servidor disparar
 * POSTs para qualquer endereço (SSRF).
 */
export function endpointDeValidacaoConfiavel(valor: unknown): string | null {
  if (typeof valor !== "string" || valor.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (host !== "totalpass.com" && !host.endsWith(".totalpass.com")) return null;
  if (!url.pathname.startsWith(CAMINHO_VALIDACAO)) return null;
  const token = url.pathname.slice(CAMINHO_VALIDACAO.length);
  if (!token || token.includes("/")) return null;
  return url.toString();
}

function texto(valor: unknown, max = 200): string | null {
  if (typeof valor !== "string") return null;
  const t = valor.trim();
  return t ? t.slice(0, max) : null;
}

function obj(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

/** Interpreta o corpo recebido. Nunca lança. */
export function lerCheckinTotalPass(corpo: unknown): LeituraCheckin {
  const raiz = obj(corpo);
  const tipo = texto(raiz.type, 60);
  if (tipo !== "CHECK_IN_CREATED") {
    return { tipo: "ignorar", motivo: `evento ${tipo ?? "sem tipo"} não tratado` };
  }

  const endpoint = endpointDeValidacaoConfiavel(raiz.endpoint);
  if (!endpoint) {
    return { tipo: "invalido", motivo: "link de validação ausente ou fora da TotalPass" };
  }
  const eventoId = decodeURIComponent(
    new URL(endpoint).pathname.slice(CAMINHO_VALIDACAO.length)
  ).slice(0, 300);

  const usuario = obj(raiz.user);
  const lugar = obj(raiz.place);
  const checkIn = obj(raiz.check_in);

  const tipoDoc = (texto(usuario.document_type, 20) ?? "cpf").toLowerCase();
  const digitos = (texto(usuario.document_number, 40) ?? "").replace(/\D/g, "");
  const cpf = tipoDoc === "cpf" && digitos.length === 11 ? digitos : null;

  return {
    tipo: "checkin",
    checkin: {
      eventoId,
      endpoint,
      cpf,
      nomeUsuario: texto(usuario.name, 120),
      codigoUnidade: texto(lugar.code, 40),
      placeUuid: texto(lugar.place, 80),
      expiraEm: texto(checkIn.expires_at, 60),
    },
  };
}

/**
 * O check-in é desta academia? Confere o código de 8 caracteres (ou o uuid)
 * da unidade com o que a TotalPass devolveu quando a academia conectou.
 * Sem nada guardado para comparar, aceita — a URL secreta já identificou a
 * academia.
 */
export function unidadeConfere(
  checkin: Pick<CheckinTotalPass, "codigoUnidade" | "placeUuid">,
  esperado: { codigo_unidade: string | null; place_uuid: string | null }
): boolean {
  const codigo = esperado.codigo_unidade?.trim().toUpperCase() || null;
  const uuid = esperado.place_uuid?.trim().toLowerCase() || null;
  if (!codigo && !uuid) return true;
  if (codigo && checkin.codigoUnidade?.toUpperCase() === codigo) return true;
  if (uuid && checkin.placeUuid?.toLowerCase() === uuid) return true;
  return false;
}

/** Formato plausível de place_api_key (a TotalPass usa UUID; aceita folga). */
export function chaveUnidadeValida(valor: string): boolean {
  return /^[A-Za-z0-9._~-]{8,200}$/.test(valor);
}
