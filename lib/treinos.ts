import type { Treino } from "./types";

/** Nível efetivo de um treino-modelo, para selo e filtro na biblioteca. */
export type NivelTreino = "plataforma" | "privado" | "equipe" | "academia";

/**
 * Classifica o NÍVEL de um treino-modelo para as abas e o selo da biblioteca,
 * combinando os dois eixos já desconflacionados:
 *   • ORIGEM — "plataforma" vem de `origem_tipo='gestacad'` (migration 076),
 *     fonte única de verdade (antes derivava de duas fontes);
 *   • VISIBILIDADE — os níveis de tenant vêm de `visibilidade` (migration 077):
 *     privado / equipe / academia.
 *
 * Fallback para dados anteriores às migrações (sem `origem_tipo`, com os valores
 * legados `instrutor`/`plataforma`): reproduz a classificação antiga, então
 * nenhum treino muda de aba durante a transição.
 *
 * Aceita qualquer objeto com os campos relevantes (não exige o Treino inteiro),
 * para ser reutilizável em contextos parciais e nos testes.
 */
export function nivelDoTreino(
  t: Pick<Treino, "origem_tipo" | "academia_id" | "visibilidade">
): NivelTreino {
  const ehPlataforma = t.origem_tipo
    ? t.origem_tipo === "gestacad"
    : t.visibilidade === "plataforma" || !t.academia_id;
  if (ehPlataforma) return "plataforma";

  switch (t.visibilidade) {
    case "academia":
      return "academia";
    case "equipe":
      return "equipe";
    case "privado":
    case "instrutor": // legado (pré-077)
      return "privado";
    default:
      // Sem visibilidade conhecida: default seguro é privado (menor exposição).
      return "privado";
  }
}
