// Aritmética monetária em centavos.
//
// As colunas financeiras do Supabase são numeric(10,2) — exatas no banco. O
// problema nasce no JavaScript: `Number(valor)` vira float64 e somar muitos
// lançamentos acumula erro (0.1 + 0.2 = 0.30000000000000004). Em uma academia
// com centenas de mensalidades, isso aparece como centavos fantasma no KPI e no
// DRE, e o dono não consegue bater a conta.
//
// A regra aqui: converter para inteiro de centavos na entrada, somar em
// inteiros, e voltar para reais só no resultado final.

/** Converte um valor em reais (number ou string do Postgres) para centavos. */
export function paraCentavos(valor: number | string | null | undefined): number {
  const n = typeof valor === "string" ? Number(valor) : valor ?? 0;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Converte centavos inteiros de volta para reais com duas casas. */
export function paraReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** Soma uma lista de valores em reais sem erro de ponto flutuante. */
export function somarValores(
  valores: Array<number | string | null | undefined>
): number {
  let centavos = 0;
  for (const v of valores) centavos += paraCentavos(v);
  return paraReais(centavos);
}

/**
 * Soma `campo` de uma lista de registros, em centavos. Use quando precisar
 * continuar somando antes de converter (evita ida e volta desnecessária).
 */
export function somarCentavos<T>(
  itens: T[],
  extrair: (item: T) => number | string | null | undefined
): number {
  let centavos = 0;
  for (const item of itens) centavos += paraCentavos(extrair(item));
  return centavos;
}

/** Diferença entre dois valores em reais, exata em centavos. */
export function subtrairValores(a: number, b: number): number {
  return paraReais(paraCentavos(a) - paraCentavos(b));
}
