/**
 * Valida se uma URL de imagem/foto é segura para armazenar no banco.
 * Rejeita: javascript:, data:, URLs relativas, e qualquer coisa sem https.
 * Aceita: https:// com host válido.
 * Retorna a URL limpa ou null se inválida/vazia.
 */
export function validarUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? "").trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname || parsed.hostname.length < 3) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Valida e retorna a URL ou lança erro descritivo para uso em Server Actions.
 * Campo é o nome do campo para a mensagem de erro.
 */
export function validarUrlObrigatoria(
  raw: string | null | undefined,
  campo: string
): { url: string } | { erro: string } {
  const url = validarUrl(raw);
  if (!url) return { erro: `O campo ${campo} deve ser uma URL https:// válida.` };
  return { url };
}

/**
 * Valida um CPF: remove formatação e garante exatamente 11 dígitos.
 * Retorna os 11 dígitos limpos ou null se inválido/vazio.
 */
export function normalizarCpf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/**
 * Valida slug de academia: somente letras minúsculas, dígitos e hífens.
 * Mínimo 3, máximo 50 caracteres. Não pode começar/terminar com hífen.
 */
export function validarSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}
