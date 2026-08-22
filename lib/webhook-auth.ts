import { timingSafeEqual } from "node:crypto";

/**
 * Compara um segredo recebido (token de webhook/cron) com o esperado em TEMPO
 * CONSTANTE, evitando o canal lateral de temporização de um `===`/`!==` de
 * string, que retorna mais cedo no primeiro caractere diferente.
 *
 * Fail-closed: sem segredo esperado configurado (null/vazio), nega sempre —
 * nunca "abre por omissão". Tamanhos diferentes também negam (timingSafeEqual
 * exige buffers do mesmo tamanho); isso vaza só o comprimento, não o conteúdo,
 * que é o padrão aceito para esse tipo de verificação.
 */
export function segredoConfere(
  fornecido: string,
  esperado: string | null | undefined
): boolean {
  if (!esperado) return false;
  const a = Buffer.from(fornecido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Extrai o token de um header `Authorization: Bearer <token>`. */
export function tokenBearer(header: string | null | undefined): string {
  const h = header ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}
