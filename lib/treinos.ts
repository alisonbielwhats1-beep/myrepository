import type { Treino } from "./types";

/** Nível efetivo de um treino-modelo, para selo e filtro na biblioteca. */
export type NivelTreino = "plataforma" | "academia" | "instrutor";

/**
 * Classifica o NÍVEL de um treino-modelo para as abas e o selo da biblioteca.
 *
 * O nível combina dois eixos, agora desconflacionados (migration 076):
 *   • "plataforma" é ORIGEM — fonte única de verdade em `origem_tipo='gestacad'`
 *     (antes derivava de DUAS fontes: `academia_id IS NULL` OU
 *     `visibilidade='plataforma'`); com fallback à regra antiga só enquanto
 *     houver dados anteriores à migração;
 *   • "instrutor" (privado) vs "academia" (compartilhado com a equipe) é o eixo
 *     de VISIBILIDADE — segue vindo de `visibilidade`, então compartilhar um
 *     modelo com a equipe continua movendo-o para a aba "Da academia" sem que a
 *     autoria (origem) mude.
 *
 * Aceita qualquer objeto com os três campos relevantes (não exige o Treino
 * inteiro), para ser reutilizável em contextos parciais e nos testes.
 */
export function nivelDoTreino(
  t: Pick<Treino, "origem_tipo" | "academia_id" | "visibilidade">
): NivelTreino {
  const ehPlataforma = t.origem_tipo
    ? t.origem_tipo === "gestacad"
    : t.visibilidade === "plataforma" || !t.academia_id;
  if (ehPlataforma) return "plataforma";
  if (t.visibilidade === "instrutor") return "instrutor";
  return "academia";
}
