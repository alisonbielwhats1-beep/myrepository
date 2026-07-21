// SaaS subscription plans and feature access control.

import type { PlanoSaas } from "./types";
export type { PlanoSaas };

export const PLANOS_SAAS: {
  value: PlanoSaas;
  label: string;
  preco: number;
  destaque?: boolean;
}[] = [
  { value: "basico", label: "Básico", preco: 29.9 },
  { value: "profissional", label: "Profissional", preco: 59.9, destaque: true },
  { value: "premium", label: "Premium", preco: 99.9 },
];

// Map each plan to the set of features it unlocks (cumulative).
const RECURSOS: Record<PlanoSaas, string[]> = {
  basico: [
    "dashboard",
    "recepcao",
    "alunos",
    "treinos",
    "configuracoes",
  ],
  profissional: [
    "dashboard",
    "recepcao",
    "alunos",
    "treinos",
    "configuracoes",
    "financeiro",
    "funcionarios",
    "equipe",
    "retencao",
    "loja",
    "feedback",
    "relatorios",
    "integracoes",
  ],
  premium: [
    "dashboard",
    "recepcao",
    "alunos",
    "treinos",
    "configuracoes",
    "financeiro",
    "funcionarios",
    "equipe",
    "retencao",
    "loja",
    "feedback",
    "relatorios",
    "integracoes",
  ],
};

export function planoPodeAcessar(plano: PlanoSaas, recurso: string): boolean {
  return RECURSOS[plano]?.includes(recurso) ?? false;
}

/** Returns the minimum plan required to access a resource. */
export function planoMinimo(recurso: string): PlanoSaas {
  for (const p of ["basico", "profissional", "premium"] as PlanoSaas[]) {
    if (RECURSOS[p].includes(recurso)) return p;
  }
  return "premium";
}

export function labelPlano(plano: PlanoSaas): string {
  return PLANOS_SAAS.find((p) => p.value === plano)?.label ?? plano;
}
