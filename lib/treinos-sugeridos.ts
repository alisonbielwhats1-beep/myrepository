/**
 * "Treino A — Peito, Ombro e Tríceps" → { titulo: "Treino A", grupos: "Peito,
 * Ombro e Tríceps" }.
 *
 * O nome dos modelos da migração 018 (e o das fichas que os instrutores
 * copiam a partir deles) segue esse formato. Separar deixa o card mostrar o
 * que interessa ao aluno — o grupo muscular — em vez da letra da divisão.
 *
 * A mesma regra existe inline na home do aluno; aqui ela é compartilhada entre
 * a lista de sugeridos e a tela de um treino sugerido.
 */
export function separarNomeTreino(nome: string): {
  titulo: string;
  grupos: string | null;
} {
  const partes = nome.split(/\s+[-–—]\s+/);
  if (partes.length < 2) return { titulo: nome.trim(), grupos: null };
  return { titulo: partes[0].trim(), grupos: partes.slice(1).join(" · ").trim() };
}
