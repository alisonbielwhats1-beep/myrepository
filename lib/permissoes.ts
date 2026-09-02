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
  | "atendimento"
  | "comunidade"
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
    "atendimento",
    "comunidade",
  ],
  // Recepção fala com aluno o dia inteiro: atender dúvida e solicitação é
  // exatamente o trabalho dela. Além de consultar, também gerencia treinos
  // (ver podeGerenciarTreinos).
  recepcao: ["dashboard", "recepcao", "alunos", "treinos", "loja", "atendimento"],
  instrutor: ["dashboard", "recepcao", "alunos", "treinos"],
};

export function podeAcessar(papel: Papel, secao: Secao): boolean {
  const p = PERMISSOES[papel];
  return p === "all" || p.includes(secao);
}

/**
 * Quem pode GERENCIAR treinos (criar, editar, excluir, atribuir a aluno, definir
 * dias, alterar visibilidade e compartilhar por link público). A partir do
 * pedido do cliente (02/09/2026), a RECEPÇÃO também gerencia treinos: passa a
 * integrar a equipe técnica de treinos como um instrutor, em vez de só consultar
 * a seção. Efetivamente, todo papel que ACESSA a seção pode gerenciá-la.
 * Centraliza a regra antes repetida como `papel === "recepcao"` em cada Server
 * Action / rota de API, evitando que uma delas divirja das outras.
 *
 * IMPORTANTE: a trava real também vive no banco (RLS + RPCs security-definer).
 * Esta função e a migration 095 (que libera a recepção no banco) andam JUNTAS —
 * sem a migration aplicada, a recepção veria os botões mas a RPC recusaria a
 * ação com "Seu perfil não pode atribuir treinos".
 */
export function podeGerenciarTreinos(papel: Papel): boolean {
  return podeAcessar(papel, "treinos");
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
