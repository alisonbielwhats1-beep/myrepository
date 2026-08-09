/**
 * Faixas comerciais internas do GestAcad (migration 056).
 *
 * Módulo PURO de propósito: só importa `./types`, nunca react/next/@supabase.
 * É o que permite compilá-lo isolado em `npm run test:faixas` — mesma razão
 * pela qual `lib/aluno-classificacao.ts` vive separado de `lib/aluno-publico.ts`.
 *
 * Nada aqui cobra, muda contrato, faz upgrade/downgrade ou bloqueia academia.
 * `faixaSugerida` é RECOMENDAÇÃO para o superadministrador olhar antes de uma
 * conversa comercial — a decisão continua sendo humana.
 */

import { FaixaComercial } from "./types";

/**
 * Acima da última faixa não existe preço de tabela por decisão comercial: o
 * caso vira negociação individual em vez de virar um "plano Enterprise".
 */
export const MENSAGEM_ACIMA_DA_TABELA =
  "Necessária avaliação comercial personalizada.";

/** Ordena por `ordem` e, no empate, pelo início do intervalo. */
function porOrdem(a: FaixaComercial, b: FaixaComercial): number {
  if (a.ordem !== b.ordem) return a.ordem - b.ordem;
  return a.alunos_min - b.alunos_min;
}

/**
 * Faixa recomendada para uma academia com `alunosAtivos` alunos ativos.
 *
 * Considera apenas faixas ativas. Devolve `null` quando nenhuma faixa cobre a
 * quantidade — inclusive quando a academia está acima do teto da tabela, caso
 * em que o painel mostra MENSAGEM_ACIMA_DA_TABELA.
 */
export function faixaSugerida(
  alunosAtivos: number,
  faixas: FaixaComercial[]
): FaixaComercial | null {
  if (!Number.isFinite(alunosAtivos) || alunosAtivos < 0) return null;

  const candidatas = faixas.filter((f) => f.ativo).sort(porOrdem);

  return (
    candidatas.find(
      (f) =>
        alunosAtivos >= f.alunos_min &&
        (f.alunos_max === null || alunosAtivos <= f.alunos_max)
    ) ?? null
  );
}

/** Texto pronto para o painel do superadministrador. */
export function rotuloFaixaSugerida(
  alunosAtivos: number,
  faixas: FaixaComercial[]
): string {
  const faixa = faixaSugerida(alunosAtivos, faixas);
  return faixa
    ? `Faixa comercial sugerida: ${faixa.nome}`
    : MENSAGEM_ACIMA_DA_TABELA;
}

/** "Até 200 alunos" · "De 201 a 350 alunos" · "Acima de 500 alunos". */
export function intervaloLabel(faixa: {
  alunos_min: number;
  alunos_max: number | null;
}): string {
  if (faixa.alunos_max === null) {
    return `Acima de ${Math.max(faixa.alunos_min - 1, 0)} alunos`;
  }
  if (faixa.alunos_min <= 0) return `Até ${faixa.alunos_max} alunos`;
  return `De ${faixa.alunos_min} a ${faixa.alunos_max} alunos`;
}

export type EntradaFaixa = {
  nome: string;
  alunos_min: number;
  alunos_max: number | null;
  preco_mensal: number;
  ordem: number;
};

/**
 * Validação usada pela Server Action ANTES de gravar — o formulário do painel
 * é conveniência, a regra vale no servidor. Devolve a mensagem de erro ou
 * `null` quando está tudo certo.
 */
export function validarFaixa(entrada: EntradaFaixa): string | null {
  if (!entrada.nome.trim()) return "Informe o nome da faixa.";
  if (entrada.nome.trim().length > 60)
    return "O nome da faixa deve ter no máximo 60 caracteres.";

  if (!Number.isInteger(entrada.alunos_min) || entrada.alunos_min < 0)
    return "O mínimo de alunos deve ser um número inteiro igual ou maior que zero.";

  if (entrada.alunos_max !== null) {
    if (!Number.isInteger(entrada.alunos_max) || entrada.alunos_max < 0)
      return "O máximo de alunos deve ser um número inteiro igual ou maior que zero.";
    if (entrada.alunos_max < entrada.alunos_min)
      return "O máximo de alunos não pode ser menor que o mínimo.";
  }

  if (!Number.isFinite(entrada.preco_mensal) || entrada.preco_mensal < 0)
    return "O valor mensal deve ser igual ou maior que zero.";

  if (!Number.isInteger(entrada.ordem) || entrada.ordem < 0)
    return "A ordem de exibição deve ser um número inteiro igual ou maior que zero.";

  return null;
}
