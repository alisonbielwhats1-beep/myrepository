import { IntelligenceIntent } from "./types";

type Rule = {
  intent: IntelligenceIntent;
  patterns: RegExp[];
  priority: number;
};

/**
 * Aliases centralizados. Novas frases entram aqui sem espalhar condicionais
 * pela UI ou pelos serviços de dados.
 */
const RULES: Rule[] = [
  {
    intent: "compare_periods",
    priority: 100,
    patterns: [
      /\bcompare\b/,
      /\bcomparacao\b/,
      /\bversus\b/,
      /\bvs\b/,
      /\b(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|mes|semana)\s+x\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|mes|semana)\b/,
    ],
  },
  {
    intent: "peak_hour",
    priority: 95,
    patterns: [
      /horario (?:mais )?movimentado/,
      /horario de pico/,
      /qual (?:foi|e) o pico/,
      /pico de (?:acessos|checkins|movimento)/,
    ],
  },
  {
    intent: "missing_students",
    priority: 90,
    patterns: [
      /alunos? sumidos?/,
      /quem (?:esta|ta) sumido/,
      /quem nao (?:esta )?vindo/,
      /quem nao aparece/,
      /quem parou de treinar/,
      /sem (?:frequentar|treinar)/,
      /alunos? afastados?/,
      /quem precisa de atencao/,
    ],
  },
  {
    intent: "overdue_students",
    priority: 90,
    patterns: [
      /inadimplen/,
      /quem (?:esta|ta) devendo/,
      /alunos? devendo/,
      /mensalidades? vencidas?/,
      /pagamentos? atrasados?/,
      /quem nao pagou/,
    ],
  },
  {
    intent: "expiring_plans",
    priority: 86,
    patterns: [
      /planos? (?:que )?vencem/,
      /planos? vencendo/,
      /perto de renovar/,
      /renovacoes? (?:de plano )?(?:da|desta|nos proximos)/,
    ],
  },
  {
    intent: "monthly_goal",
    priority: 85,
    patterns: [
      /meta (?:de )?(?:faturamento|financeira|mensal)/,
      /quanto falta para (?:a|minha) meta/,
      /bati (?:a|minha) meta/,
    ],
  },
  {
    intent: "financial_summary",
    priority: 82,
    patterns: [
      /como (?:esta|ta) (?:o |meu )?financeiro/,
      /resumo financeiro/,
      /situacao financeira/,
      /financeiro (?:do|de|deste|desse) mes/,
    ],
  },
  {
    intent: "revenue",
    priority: 80,
    patterns: [
      /faturamento/,
      /faturei/,
      /receita (?:recebida|do|de|em|no|na)/,
      /quanto (?:entrou|recebemos)/,
      /valor recebido/,
    ],
  },
  {
    intent: "new_students",
    priority: 78,
    patterns: [
      /novos? alunos?/,
      /alunos? novos?/,
      /quantos? alunos? (?:entraram|cadastrados?|matriculados?)/,
      /novas? matriculas?/,
    ],
  },
  {
    intent: "active_students",
    priority: 77,
    patterns: [
      /alunos? ativos?/,
      /quantos? alunos? (?:tenho|temos)/,
      /total de alunos? ativos?/,
    ],
  },
  {
    intent: "checkins",
    priority: 75,
    patterns: [
      /checkins/,
      /quantas? (?:pessoas )?(?:vieram|entraram)/,
      /quantos? (?:acessos|entradas)/,
      /acessos? (?:na academia|hoje|ontem|no|em)/,
    ],
  },
  {
    intent: "attendance_summary",
    priority: 72,
    patterns: [
      /como (?:esta|foi) (?:o )?movimento/,
      /movimento de (?:hoje|ontem)/,
      /resumo de frequencia/,
      /frequencia (?:da|dos|de|no|na)/,
    ],
  },
  {
    intent: "business_summary",
    priority: 65,
    patterns: [
      /como foi (?:o )?(?:mes de )?(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|este mes|mes passado)/,
      /como (?:esta|ta) (?:a |minha )?academia/,
      /resumo (?:da|de minha|do negocio|do mes)/,
      /visao geral/,
    ],
  },
];

export function detectIntent(normalizedQuestion: string): IntelligenceIntent {
  let best: { intent: IntelligenceIntent; score: number } = {
    intent: "unknown",
    score: 0,
  };

  for (const rule of RULES) {
    const matches = rule.patterns.filter((pattern) => pattern.test(normalizedQuestion)).length;
    if (!matches) continue;
    const score = rule.priority + matches * 5;
    if (score > best.score) best = { intent: rule.intent, score };
  }

  return best.intent;
}
