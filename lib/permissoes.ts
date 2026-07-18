import { Papel } from "./types";

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
  | "equipe";

const PERMISSOES: Record<Papel, Secao[] | "all"> = {
  dono: "all",
  gerente: [
    "dashboard",
    "recepcao",
    "alunos",
    "treinos",
    "funcionarios",
    "loja",
    "financeiro",
    "feedback",
    "relatorios",
    "retencao",
  ],
  recepcao: ["dashboard", "recepcao", "alunos", "loja"],
  instrutor: ["dashboard", "alunos", "treinos"],
};

export function podeAcessar(papel: Papel, secao: Secao): boolean {
  const p = PERMISSOES[papel];
  return p === "all" || p.includes(secao);
}
