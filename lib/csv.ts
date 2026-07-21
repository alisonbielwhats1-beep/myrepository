"use client";

/** Escapa um valor para uma célula CSV (RFC 4180) + previne injeção de fórmula.
 *  Excel/Sheets interpretam células que começam com = + - @ (ou tab/CR) como
 *  fórmula — um comentário de feedback como `=HYPERLINK(...)` viraria código ao
 *  abrir o export. Prefixamos com apóstrofo para forçar texto. */
function celula(valor: unknown): string {
  let s = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Gera um CSV (compatível com Excel/Google Sheets, separador `;` para o
 * padrão brasileiro) e dispara o download no navegador.
 */
export function baixarCSV(
  nomeArquivo: string,
  cabecalho: string[],
  linhas: (string | number | null | undefined)[][]
) {
  const BOM = "﻿"; // garante acentuação correta ao abrir no Excel
  const conteudo =
    BOM +
    [cabecalho, ...linhas]
      .map((linha) => linha.map(celula).join(";"))
      .join("\r\n");

  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".csv") ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
