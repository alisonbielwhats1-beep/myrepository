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
  // Preço comercial oficial do GestAcad Premium: R$ 99/mês (era 99,90 até a
  // definição do preço de vitrine). Espelhado em lib/site-config.ts, que é a
  // fonte usada pela landing page pública.
  { value: "premium", label: "Premium", preco: 99 },
];

// Map each plan to the set of features it unlocks (cumulative).
const RECURSOS: Record<PlanoSaas, string[]> = {
  basico: [
    "dashboard",
    "recepcao",
    "alunos",
    "treinos",
    "configuracoes",
    // Canal de comunicação com o aluno: liberado em todos os planos de
    // propósito. Transformar atendimento em item pago é decisão comercial,
    // não técnica — se um dia for, basta tirar daqui.
    "atendimento",
    // Comunidade faz parte do app do aluno (como Treinos) — todos os planos.
    "comunidade",
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
    "atendimento",
    "comunidade",
    "relatorios",
  ],
  // O Premium só existe se entregar algo que o Profissional não entrega. Até
  // 10/09/2026 as duas listas eram IDÊNTICAS: quem pagava R$ 99 recebia
  // exatamente o que R$ 59,90 dava, e o botão de upgrade não tinha para onde
  // levar. Pior: a tela de plano já vendia "Integrações Gympass e TotalPass"
  // como exclusivo do Premium — a promessa existia, só não estava no código.
  //
  // A fronteira agora é o que a academia usa para CRESCER, não para operar:
  //   • integracoes  — check-in automático de Gympass/TotalPass (era a promessa);
  //   • intelligence — pergunta em linguagem natural sobre os próprios dados.
  // Operação inteira (alunos, treinos, financeiro, loja, BI) segue no
  // Profissional: ninguém fica sem tocar a academia por causa de plano.
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
    "atendimento",
    "comunidade",
    "relatorios",
    "integracoes",
    "intelligence",
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

/**
 * Rótulo comercial de cada recurso vendável, para a tela de plano.
 *
 * Existe para a vitrine ser DERIVADA de RECURSOS, nunca escrita à mão ao lado
 * dela: até 10/09/2026 a tela prometia Gympass como exclusivo do Premium
 * enquanto o código entregava no Profissional, e nada acusava a divergência.
 * Agora o plano de cada linha vem de `planoMinimo()` — mudar RECURSOS muda a
 * vitrine junto, e uma promessa sem recurso por trás vira erro de tipo.
 *
 * Só entram recursos que a academia PERCEBE ao comprar. `dashboard`,
 * `recepcao`, `alunos`, `treinos` e `configuracoes` estão em todos os planos e
 * aparecem resumidos numa linha só.
 */
export const RECURSOS_VENDAVEIS: { recurso: string; label: string }[] = [
  { recurso: "alunos", label: "Alunos, treinos e recepção" },
  { recurso: "comunidade", label: "App do aluno e comunidade" },
  { recurso: "financeiro", label: "Financeiro (receitas, despesas, DRE)" },
  { recurso: "funcionarios", label: "Funcionários e folha salarial" },
  { recurso: "equipe", label: "Múltiplos usuários (equipe)" },
  { recurso: "retencao", label: "Retenção e frequência" },
  { recurso: "loja", label: "Loja e controle de estoque" },
  { recurso: "feedback", label: "Feedback e NPS" },
  { recurso: "relatorios", label: "Relatórios e BI" },
  { recurso: "integracoes", label: "Integrações Gympass e TotalPass" },
  { recurso: "intelligence", label: "GestAcad Intelligence (perguntas em linguagem natural)" },
];

/**
 * Recursos que só aparecem A PARTIR de um plano — o que a academia ganha ao
 * subir para ele. Vazio significa um plano pago que não entrega nada a mais
 * que o anterior, exatamente o defeito que existia entre Profissional e
 * Premium; `tests/planos.test.mjs` reprova se isso voltar a acontecer.
 */
export function recursosExclusivos(plano: PlanoSaas): string[] {
  const ordem: PlanoSaas[] = ["basico", "profissional", "premium"];
  const i = ordem.indexOf(plano);
  if (i <= 0) return [...RECURSOS[plano ?? "basico"]];
  const anterior = new Set(RECURSOS[ordem[i - 1]]);
  return RECURSOS[plano].filter((r) => !anterior.has(r));
}
