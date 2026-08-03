// Montagem dos exercícios de uma ficha de treino, compartilhada pelas três
// Server Actions que gravam em `exercicios_treino`:
//   • criarTreino            (app/painel/[slug]/alunos/actions.ts)  — ficha do aluno
//   • atualizarTreino        (app/painel/[slug]/alunos/actions.ts)  — edição da ficha
//   • criarTreinoBiblioteca  (app/painel/[slug]/treinos/actions.ts) — treino-modelo
//
// POR QUE ESTE MÓDULO EXISTE
//   A lógica vivia duplicada nas actions de criar, e as cópias divergiram: a
//   de `criarTreino` passava a imagem e o vídeo por `validarUrl()`, que só
//   aceita URL https:// absoluta. Isso descartava silenciosamente (virava
//   null) tanto o `data:` URL da foto comprimida no navegador quanto o
//   caminho relativo dos clipes do catálogo (`/videos/catalogo/...`) — e a
//   outra cópia não tinha esse problema. Com a edição de treino entrando,
//   seriam três cópias para manter em sincronia. Centralizar aqui é o que
//   impede a divergência de voltar.

/** Uma linha do construtor de exercícios (components/painel/ExercicioBuilder.tsx). */
export type ExercicioEntrada = {
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number;
  descanso_segundos: number;
  observacoes: string;
  imagem_demonstracao_url: string;
  video_demonstracao_url: string;
};

/** Linha pronta para inserir em `exercicios_treino`. */
export type ExercicioLinhaBanco = {
  treino_id: string;
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number;
  descanso_segundos: number | null;
  observacoes: string | null;
  imagem_demonstracao_url: string | null;
  video_demonstracao_url: string | null;
  ordem: number;
};

/**
 * Lê e valida o campo oculto `exercicios_json` publicado pelo ExercicioBuilder.
 * Descarta linhas sem nome (o construtor permite uma linha vazia em edição).
 */
export function lerExerciciosDoFormulario(
  bruto: FormDataEntryValue | null
): { exercicios: ExercicioEntrada[] } | { erro: string } {
  let lista: unknown;
  try {
    lista = JSON.parse(String(bruto ?? "[]"));
  } catch {
    return { erro: "Lista de exercícios inválida." };
  }
  if (!Array.isArray(lista)) {
    return { erro: "Lista de exercícios inválida." };
  }

  const exercicios = (lista as ExercicioEntrada[]).filter((e) =>
    e?.nome_exercicio?.trim()
  );
  if (exercicios.length === 0) {
    return { erro: "Adicione ao menos um exercício com nome." };
  }
  return { exercicios };
}

/**
 * Converte as linhas do construtor em linhas de `exercicios_treino`.
 *
 * A mídia é gravada com trim-or-null e NUNCA passa por `validarUrl()`: os
 * valores legítimos incluem `data:` URLs (foto comprimida no navegador por
 * ImageUpload) e caminhos relativos (`/videos/catalogo/...`, migration 054),
 * que aquela função rejeita por exigir https:// absoluta.
 *
 * `descanso_segundos` 0 vira null — 0 significa "não informado" no
 * construtor, e o card do aluno só exibe o chip de descanso quando não é null.
 */
export function montarLinhasExercicio(
  treinoId: string,
  exercicios: ExercicioEntrada[]
): ExercicioLinhaBanco[] {
  return exercicios.map((ex, idx) => ({
    treino_id: treinoId,
    nome_exercicio: ex.nome_exercicio.trim(),
    series: Number(ex.series) || 0,
    repeticoes: ex.repeticoes || "0",
    carga_kg: Number(ex.carga_kg) || 0,
    descanso_segundos: Number(ex.descanso_segundos) || null,
    observacoes: ex.observacoes?.trim() || null,
    imagem_demonstracao_url: ex.imagem_demonstracao_url?.trim() || null,
    video_demonstracao_url: ex.video_demonstracao_url?.trim() || null,
    ordem: idx + 1,
  }));
}
