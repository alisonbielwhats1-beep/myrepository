import { Papel } from "./types";

/** Máximo de pessoas (perfis_admin) por academia na equipe. */
export const LIMITE_MEMBROS_EQUIPE = 5;

/** Seções do painel que podem ser restritas por papel. */
export type Secao =
  | "dashboard"
  | "recepcao"
  | "alunos"
  | "treinos"
  | "funcionarios"
  | "loja"
  | "financeiro"
  | "feedback"
  | "relatorios"
  | "retencao"
  | "configuracoes"
  | "integracoes"
  | "equipe";

// Financeiro (receitas, despesas, DRE, planos, projeção de caixa) é
// exclusivo do dono — nenhum outro papel enxerga essa seção.
const PERMISSOES: Record<Papel, Secao[] | "all"> = {
  dono: "all",
  gerente: [
    "dashboard",
    "recepcao",
    "alunos",
    "treinos",
    "loja",
    "funcionarios",
    "retencao",
    "relatorios",
    "feedback",
  ],
  recepcao: ["dashboard", "recepcao", "alunos", "treinos", "loja"],
  instrutor: ["dashboard", "recepcao", "alunos", "treinos"],
};

export function podeAcessar(papel: Papel, secao: Secao): boolean {
  const p = PERMISSOES[papel];
  return p === "all" || p.includes(secao);
}

/**
 * Verdadeiro se trocar o papel de alguém (ou removê-la) deixaria a academia
 * sem nenhum "dono". `papelNovo` é `null` no caso de remoção.
 *
 * `totalDonosAtual` é a contagem de perfis com papel "dono" na academia
 * ANTES da ação (inclui a própria pessoa, se ela já for dono).
 */
export function removeriaUltimoDono(
  papelAtual: Papel,
  papelNovo: Papel | null,
  totalDonosAtual: number
): boolean {
  if (papelAtual !== "dono") return false; // não é dono: não afeta a contagem
  if (papelNovo === "dono") return false; // continua dono: não é rebaixamento/remoção
  return totalDonosAtual <= 1;
}
