// Token de convite de ativação — geração e hash. Lógica isolada e testável
// (npm run test:convites), separada das Server Actions que falam com o banco.
//
// PRINCÍPIO DE SEGURANÇA: o token BRUTO só existe no link entregue ao aluno e
// na memória do servidor durante a validação. No banco guardamos SOMENTE o
// hash sha-256 (ver migration 065/066). Assim, um vazamento do banco não
// permite ativar convites, e o token nunca aparece completo em log/analytics.

import { createHash, randomBytes } from "crypto";

/** Bytes de entropia do token. 32 bytes = 256 bits — imprevisível na prática. */
export const TOKEN_BYTES = 32;

/** Prazo padrão de expiração do convite (dias), dentro de limites seguros. */
export const CONVITE_EXPIRACAO_DIAS_PADRAO = 7;
export const CONVITE_EXPIRACAO_DIAS_MIN = 1;
export const CONVITE_EXPIRACAO_DIAS_MAX = 30;

/**
 * Gera um token aleatório criptograficamente seguro, em base64url (sem `=`,
 * `+` ou `/`), próprio para caber numa URL/QR sem escaping.
 */
export function gerarTokenConvite(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hash sha-256 (hex) do token bruto. Determinístico: o mesmo token sempre gera
 * o mesmo hash, então dá para procurar no banco por igualdade. É o ÚNICO
 * formato do token que o banco conhece.
 */
export function hashTokenConvite(tokenBruto: string): string {
  return createHash("sha256").update(tokenBruto, "utf8").digest("hex");
}

/**
 * Valida o formato do token recebido na URL antes de qualquer consulta: só
 * caracteres base64url e comprimento coerente com TOKEN_BYTES. Rejeitar cedo
 * evita consultas inúteis e não vaza motivo (tudo vira "convite inválido").
 */
export function tokenTemFormatoValido(token: unknown): token is string {
  if (typeof token !== "string") return false;
  // 32 bytes em base64url -> 43 caracteres (sem padding).
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

/** Normaliza o número de dias de expiração para dentro dos limites seguros. */
export function normalizarExpiracaoDias(dias: unknown): number {
  const n = Number(dias);
  if (!Number.isFinite(n)) return CONVITE_EXPIRACAO_DIAS_PADRAO;
  const inteiro = Math.floor(n);
  if (inteiro < CONVITE_EXPIRACAO_DIAS_MIN) return CONVITE_EXPIRACAO_DIAS_MIN;
  if (inteiro > CONVITE_EXPIRACAO_DIAS_MAX) return CONVITE_EXPIRACAO_DIAS_MAX;
  return inteiro;
}

/** Timestamp ISO de expiração a partir de agora + N dias (já normalizado). */
export function calcularExpiracao(dias: unknown, agora: Date = new Date()): string {
  const d = normalizarExpiracaoDias(dias);
  const fim = new Date(agora.getTime() + d * 24 * 60 * 60 * 1000);
  return fim.toISOString();
}

/**
 * Monta o link de ativação. O token vai no PATH (não em query) para reduzir a
 * chance de ele vazar em `Referer`/analytics de terceiros. `baseUrl` deve ser
 * um domínio autorizado (NEXT_PUBLIC_SITE_URL).
 */
export function montarLinkConvite(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/ativar/${encodeURIComponent(token)}`;
}
