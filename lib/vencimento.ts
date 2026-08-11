// Dia de vencimento da mensalidade — a regra que permite escolher 29, 30 ou 31
// sem quebrar em fevereiro.
//
// O PROBLEMA
//   Até 2026-08-11 o sistema só aceitava dias 1 a 28, porque é o maior dia que
//   existe em TODO mês. Isso resolvia o bug e criava outro: a academia que
//   cobra todo mundo no último dia do mês não conseguia representar isso, e o
//   cliente pediu o dia 31.
//
// A REGRA
//   O aluno guarda o dia PRETENDIDO (1 a 31). A data real de cada cobrança é
//   `min(dia_pretendido, último dia daquele mês)`. Quem escolheu 31 vence:
//     - 31 em janeiro, março, maio, julho, agosto, outubro e dezembro;
//     - 30 em abril, junho, setembro e novembro;
//     - 28 em fevereiro — 29 em ano bissexto.
//   Ou seja, "31" na prática significa "último dia do mês", que é exatamente o
//   que a academia quer dizer.
//
//   Isto NÃO é uma regra nova: é a mesma que as funções do banco já aplicam
//   desde a migration 025 (`LEAST(r.dia_vencimento, v_ultimo_dia)`) na geração
//   mensal recorrente. O que faltava era o app concordar com o banco — o
//   `Math.min(dia, 28)` do TypeScript era o único lugar que discordava.
//
// PURO (sem I/O): compila isolado pelo `npm run test:vencimento`.

/** Menor e maior dia que o cadastro aceita. 31 = último dia do mês. */
export const DIA_VENCIMENTO_MIN = 1;
export const DIA_VENCIMENTO_MAX = 31;

/**
 * Último dia de um mês — 28, 29, 30 ou 31, com ano bissexto correto.
 *
 * `mes` é 1..12 (janeiro = 1), não o 0..11 do Date do JavaScript. Usa UTC de
 * propósito: com o construtor local, um servidor em fuso negativo poderia
 * recuar a data para o mês anterior e devolver o último dia errado.
 */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  // Dia 0 do mês seguinte é o último dia do mês pedido.
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Converte o dia escolhido pelo aluno no dia real de vencimento naquele mês.
 *
 *   diaVencimentoDoMes(31, 2026, 2) -> 28   (fevereiro comum)
 *   diaVencimentoDoMes(31, 2028, 2) -> 29   (fevereiro bissexto)
 *   diaVencimentoDoMes(31, 2026, 4) -> 30   (abril)
 *   diaVencimentoDoMes(10, 2026, 2) -> 10   (dia normal, não muda)
 *
 * Valores fora de 1..31 são trazidos para dentro do intervalo em vez de
 * lançarem erro: esta função é chamada na hora de gerar cobrança, e uma
 * mensalidade não pode deixar de existir por causa de um dia inválido gravado
 * no passado.
 */
export function diaVencimentoDoMes(
  diaEscolhido: number,
  ano: number,
  mes: number
): number {
  const dia = Math.min(
    DIA_VENCIMENTO_MAX,
    Math.max(DIA_VENCIMENTO_MIN, Math.trunc(diaEscolhido) || DIA_VENCIMENTO_MIN)
  );
  return Math.min(dia, ultimoDiaDoMes(ano, mes));
}

/**
 * Lê um dia de vencimento vindo de formulário/planilha.
 * Devolve o número quando é um inteiro de 1 a 31, ou null quando está vazio ou
 * fora do intervalo — quem chama decide se isso é erro ou se aplica o padrão.
 */
export function lerDiaVencimento(valor: string | number | null | undefined): number | null {
  const n = typeof valor === "number" ? valor : parseInt(String(valor ?? ""), 10);
  if (!Number.isFinite(n)) return null;
  if (n < DIA_VENCIMENTO_MIN || n > DIA_VENCIMENTO_MAX) return null;
  return Math.trunc(n);
}

/**
 * Texto curto para a tela, deixando explícito o que acontece nos meses curtos.
 * "Dia 31" sozinho faria a recepção achar que fevereiro ficaria sem cobrança.
 */
export function rotuloDiaVencimento(dia: number | null | undefined): string {
  if (!dia) return "—";
  if (dia > 28) return `Dia ${dia} (ou o último do mês)`;
  return `Dia ${dia}`;
}
