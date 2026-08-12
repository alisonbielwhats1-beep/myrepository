// Proteção contra open redirect (Prompt seção 12). Parâmetros como `next`,
// `redirect`, `returnTo` NUNCA podem levar a domínio externo ou protocolo
// perigoso. Lógica pura -> testável por npm run test:redirecionamento.

/**
 * Devolve um caminho INTERNO seguro a partir de um parâmetro não confiável, ou
 * `fallback` quando o valor não é um caminho interno claramente seguro.
 *
 * Regras (todas precisam passar):
 *   - é string não vazia;
 *   - começa com "/" (caminho absoluto do próprio site);
 *   - NÃO começa com "//" nem "/\" (isso seria "//host" = outro domínio);
 *   - não contém "://" (esquema absoluto embutido);
 *   - não usa esquema perigoso (javascript:, data:, etc.);
 *   - não contém caractere de controle nem espaço em branco.
 *
 * Não seguimos "para onde" o caminho leva em nível de autorização — isso é
 * papel do RLS/guarda de rota depois do login. Aqui só garantimos que o
 * destino é DENTRO do site.
 */
export function caminhoInternoSeguro(valor: unknown, fallback = "/"): string {
  if (typeof valor !== "string") return fallback;
  const v = valor.trim();
  if (v.length === 0) return fallback;
  // Barra dupla ou barra+contrabarra = host relativo a protocolo -> externo.
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  // Esquema embutido (http://, javascript:, etc.).
  if (v.includes("://")) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return fallback;
  // Espaço em branco (espaço, tab, quebra de linha) não pertence a um path.
  if (/\s/.test(v)) return fallback;
  // Caracteres de controle (código < 32) — checados sem regex de controle
  // para manter o lint limpo e o código legível.
  for (let i = 0; i < v.length; i++) {
    if (v.charCodeAt(i) < 32) return fallback;
  }
  return v;
}

/**
 * True se o valor é um caminho interno seguro (sem substituir por fallback).
 * Útil para decidir "voltar ao destino" vs "ir ao painel padrão".
 */
export function ehCaminhoInternoSeguro(valor: unknown): boolean {
  return caminhoInternoSeguro(valor, "INVALIDO") !== "INVALIDO";
}
