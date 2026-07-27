// Helpers puros de paginação e busca (Fase 13 — performance e escala).
// Sem dependência de Supabase: só matemática de range e construção de string
// de filtro, para poderem ser testados sem banco (ver tests/paginacao.test.mjs).

/** Página e tamanho sempre dentro de limites seguros — nunca 0, nunca negativo,
 *  nunca maior que `tamanhoMax` (evita alguém montar ?tamanhoPagina=100000 na URL
 *  e forçar uma consulta gigante). */
export function calcularRange(
  pagina: number,
  tamanhoPagina: number,
  tamanhoMax = 100
): { pagina: number; tamanho: number; de: number; ate: number } {
  const tamanho = Math.min(Math.max(Math.trunc(tamanhoPagina) || 1, 1), tamanhoMax);
  const paginaSegura = Math.max(Math.trunc(pagina) || 1, 1);
  const de = (paginaSegura - 1) * tamanho;
  const ate = de + tamanho - 1;
  return { pagina: paginaSegura, tamanho, de, ate };
}

/** Só dígitos — mesma normalização usada na busca de telefone do cliente
 *  (components/painel/CatracaLog.tsx), reaproveitada aqui para a busca no servidor. */
export function apenasDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Escapa um termo de busca para uso seguro dentro de um filtro `ilike` do
 * PostgREST: `%` e `_` são coringas do LIKE (escapados com `\`), e `,`/`(`/`)`
 * quebrariam a sintaxe de `.or("col.ilike.%x%,col2.ilike.%y%")` por serem os
 * separadores/agrupadores desse formato — removidos em vez de escapados
 * porque o PostgREST não aceita escape para eles dentro de `.or()`.
 */
export function sanitizarTermoBusca(termo: string): string {
  return termo
    .trim()
    .replace(/[,()]/g, " ")
    .replace(/[%_\\]/g, (c) => `\\${c}`)
    .trim();
}

/**
 * Monta a string do filtro `.or()` para buscar alunos por nome, matrícula ou
 * telefone (por dígitos, ignorando formatação) em uma única ida ao banco.
 * Retorna null quando o termo fica vazio após sanitizar (nada para filtrar).
 */
export function construirFiltroBuscaAlunos(termoBruto: string): string | null {
  const termo = sanitizarTermoBusca(termoBruto);
  const digitos = apenasDigitos(termoBruto);
  if (!termo && !digitos) return null;

  const partes: string[] = [];
  if (termo) {
    partes.push(`nome.ilike.%${termo}%`);
    partes.push(`matricula_codigo.ilike.%${termo}%`);
  }
  if (digitos) {
    partes.push(`telefone_digitos.ilike.%${digitos}%`);
  }
  return partes.join(",");
}
