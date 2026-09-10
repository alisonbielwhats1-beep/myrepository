// Sugestão de progressão de carga — helpers puros (sem I/O, sem React/Next).
//
// O QUE É
//   O aluno já registra, a cada série, a carga que usou e o esforço percebido
//   (leve / médio / pesado — o RPE de um toque da migration 093). Até aqui esse
//   dado só voltava como "última vez: 40 kg". Aqui ele vira a próxima decisão:
//   "você marcou leve — tenta 42,5 kg".
//
// POR QUE É CONSERVADOR DE PROPÓSITO
//   Isto aparece para uma pessoa real, sozinha na sala, prestes a levantar peso.
//   Errar para mais machuca; errar para menos só deixa o treino igual ao da
//   semana passada. Então a regra falha fechada:
//
//     • só sugere quando o aluno marcou LEVE. "Médio" significa que a carga
//       está certa, e "pesado" que já está no limite — nos dois casos, silêncio;
//     • só sugere se ele CONCLUIU o exercício. Quem não terminou a série não
//       tem por que subir peso;
//     • um passo por vez, nunca dois;
//     • sem histórico, sem sugestão.
//
//   E o incremento não é percentual: é o menor passo que EXISTE numa academia.
//   Sugerir "41,3 kg" seria matematicamente elegante e inútil na frente do
//   rack de anilhas.
//
// O QUE ISTO NÃO É
//   Não é prescrição. Quem prescreve é o instrutor, na ficha. A tela mostra a
//   sugestão como um atalho que o aluno toca se quiser — o campo continua
//   pré-preenchido com a carga anterior, não com a sugerida.

import type { EsforcoTreino } from "./types";

/** Última execução registrada de um exercício, vinda da sessão finalizada mais recente. */
export type UltimaExecucao = {
  carga: number;
  esforco: EsforcoTreino | null;
  concluido: boolean;
};

export type SugestaoCarga = {
  /** Carga sugerida para hoje. */
  carga: number;
  /** Quanto sobe em relação à última vez. */
  incremento: number;
  /** Carga da última vez, para a tela poder explicar de onde veio. */
  anterior: number;
};

/**
 * Menor passo de carga utilizável, por faixa. Reflete o que existe de verdade:
 * halteres sobem de 1 em 1 kg embaixo e de 2 em 2 no meio da estante; barra com
 * anilhas sobe de 2,5 kg (uma de 1,25 de cada lado) e, mais pesado, de 5.
 *
 * Nas cargas baixas o passo é grande em porcentagem (1 kg sobre 5 kg é 20%),
 * e não há o que fazer: não existe anilha menor. Por isso a sugestão só sai
 * quando o próprio aluno disse que estava leve.
 */
export function incrementoPara(carga: number): number {
  if (carga < 10) return 1;
  if (carga < 20) return 2;
  if (carga < 50) return 2.5;
  return 5;
}

/**
 * Sugere a carga de hoje a partir da última execução — ou null quando não há
 * base segura para sugerir nada.
 */
export function sugerirCarga(
  ultima: UltimaExecucao | null | undefined
): SugestaoCarga | null {
  if (!ultima) return null;

  const anterior = Number(ultima.carga);
  if (!Number.isFinite(anterior) || anterior <= 0) return null;

  // Não terminou: subir peso seria a orientação oposta à necessária.
  if (!ultima.concluido) return null;

  // Só "leve" autoriza subir. Sem esforço informado também não sugere: a
  // ausência de dado não é sinal de facilidade.
  if (ultima.esforco !== "leve") return null;

  const incremento = incrementoPara(anterior);
  return {
    // Duas casas evitam o 42,50000000000001 da aritmética de ponto flutuante.
    carga: Number((anterior + incremento).toFixed(2)),
    incremento,
    anterior,
  };
}

/**
 * Aplica `sugerirCarga` a um mapa de exercício → última execução, devolvendo só
 * as entradas que renderam sugestão. Mapa vazio significa "nenhuma sugestão
 * hoje", que é exatamente o que a tela deve mostrar quando a migration 107
 * ainda não foi aplicada e o histórico não chega.
 */
export function sugestoesDeCarga(
  ultimas: Record<string, UltimaExecucao>
): Record<string, SugestaoCarga> {
  const saida: Record<string, SugestaoCarga> = {};
  for (const [exercicioId, ultima] of Object.entries(ultimas ?? {})) {
    const sugestao = sugerirCarga(ultima);
    if (sugestao) saida[exercicioId] = sugestao;
  }
  return saida;
}

/** "42,5" — número de carga como o aluno lê, sem zeros à toa. */
export function formatarCarga(kg: number): string {
  return kg.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
