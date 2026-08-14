import "server-only";

import { getResumoFinanceiro, getRetencaoAlunos } from "@/lib/data";
import { caixaDoResumo, pendenciasDoResumo } from "@/lib/financeiro";
import { createClient } from "@/lib/supabase/server";
import { SessaoAcademia } from "@/lib/types";
import {
  classificarRetencao,
  configRetencaoDe,
  formatBRL,
} from "@/lib/utils";
import { isPastPeriod, previousPeriod } from "./date-range";
import {
  IntelligenceAnswer,
  IntelligenceDelta,
  IntelligencePeriod,
  ParsedIntelligenceQuestion,
} from "./types";

const DEFAULT_SUGGESTIONS = [
  "Quem está sumido?",
  "Como está meu financeiro?",
  "Quem está devendo?",
  "Movimento de hoje",
];

type OperationalSummary = {
  total_checkins: number | string;
  pico_hora: number | string | null;
  pico_quantidade: number | string;
  novos_alunos: number | string;
  alunos_ativos: number | string;
};

type OverdueResult = {
  total: number;
  totalValue: number;
  items: {
    id: string;
    name: string;
    dueDate: string;
    daysOverdue: number;
    value: number;
    charges: number;
  }[];
};

type ExpiringResult = {
  total: number;
  items: {
    id: string;
    name: string;
    plan: string;
    dueDate: string;
    value: number;
    charges: number;
  }[];
};

const integer = (value: number | string | null | undefined) =>
  Number(value ?? 0);

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function hourLabel(hour: number | null): string {
  return hour === null ? "Sem dados" : `${String(hour).padStart(2, "0")}h`;
}

function delta(
  current: number,
  previous: number,
  positiveWhenIncreasing = true
): IntelligenceDelta | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return undefined;
  }
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  const rising = percent > 0;
  const isPositive = percent === 0 ? null : rising === positiveWhenIncreasing;
  return {
    label: `${percent >= 0 ? "+" : ""}${percent.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`,
    sentiment:
      isPositive === null ? "neutral" : isPositive ? "positive" : "negative",
  };
}

function money(value: number | string | null | undefined): string {
  return formatBRL(Number(value ?? 0));
}

function financeNotice(
  summary: Awaited<ReturnType<typeof getResumoFinanceiro>>
): string | undefined {
  const incomplete = Number(summary?.incompletas_receitas ?? 0);
  if (!incomplete) return undefined;
  return `${incomplete} recebimento(s) antigo(s) não entram no cálculo porque não possuem data de pagamento.`;
}

function joinNotices(...notices: (string | undefined)[]): string | undefined {
  const values = notices.filter((notice): notice is string => !!notice);
  return values.length ? values.join(" ") : undefined;
}

async function getOperationalSummary(
  period: IntelligencePeriod
): Promise<OperationalSummary> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("intelligence_resumo_operacional", {
      p_inicio: period.start,
      p_fim: period.end,
    })
    .maybeSingle();
  if (error) throw new Error(`Falha ao consultar movimento: ${error.message}`);
  return (
    (data as OperationalSummary | null) ?? {
      total_checkins: 0,
      pico_hora: null,
      pico_quantidade: 0,
      novos_alunos: 0,
      alunos_ativos: 0,
    }
  );
}

async function getOverdueStudents(): Promise<OverdueResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "intelligence_inadimplentes_atuais",
    { p_limite: 5 }
  );
  if (error) throw new Error(`Falha ao consultar inadimplência: ${error.message}`);
  return (data as OverdueResult | null) ?? { total: 0, totalValue: 0, items: [] };
}

async function getExpiringPlans(period: IntelligencePeriod): Promise<ExpiringResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("intelligence_planos_vencendo", {
    p_inicio: period.start,
    p_fim: period.end,
    p_limite: 5,
  });
  if (error) throw new Error(`Falha ao consultar vencimentos: ${error.message}`);
  return (data as ExpiringResult | null) ?? { total: 0, items: [] };
}

function historyUnavailable(intent: ParsedIntelligenceQuestion["intent"]): IntelligenceAnswer {
  const labels: Partial<Record<ParsedIntelligenceQuestion["intent"], string>> = {
    missing_students: "ausência dos alunos",
    overdue_students: "inadimplência",
    active_students: "situação das matrículas",
  };
  return {
    intent,
    title: "Histórico insuficiente",
    description:
      "Ainda não tenho histórico suficiente para responder essa pergunta com segurança.",
    notice: `O GestAcad registra o estado atual de ${labels[intent] ?? "alguns dados"}, mas não uma fotografia completa de cada dia passado.`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function unknownAnswer(): IntelligenceAnswer {
  return {
    intent: "unknown",
    title: "Ainda não consigo responder isso diretamente.",
    description: "Hoje posso ajudar com alunos, financeiro, mensalidades, planos, frequência e check-ins.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

async function revenueAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const comparisonPeriod = previousPeriod(parsed.period);
  const [current, previous] = await Promise.all([
    getResumoFinanceiro(parsed.period.start, parsed.period.end),
    getResumoFinanceiro(comparisonPeriod.start, comparisonPeriod.end),
  ]);
  const currentCash = caixaDoResumo(current);
  const previousCash = caixaDoResumo(previous);
  return {
    intent: "revenue",
    title: `Receita · ${parsed.period.label}`,
    period: parsed.period,
    metrics: [
      {
        label: "Receita recebida",
        value: money(currentCash.receitaRecebida),
        detail: `${comparisonPeriod.label}: ${money(previousCash.receitaRecebida)}`,
        delta: delta(currentCash.receitaRecebida, previousCash.receitaRecebida),
      },
    ],
    action: { label: "Abrir financeiro", href: `/painel/${slug}/financeiro` },
    notice: financeNotice(current),
  };
}

async function financialSummaryAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const summary = await getResumoFinanceiro(parsed.period.start, parsed.period.end);
  const cash = caixaDoResumo(summary);
  const overdue = pendenciasDoResumo(summary, "receber");
  return {
    intent: "financial_summary",
    title: `Financeiro · ${parsed.period.label}`,
    period: parsed.period,
    metrics: [
      { label: "Receita recebida", value: money(cash.receitaRecebida) },
      { label: "Despesa paga", value: money(cash.despesaPaga) },
      { label: "Resultado", value: money(cash.resultado) },
      {
        label: "Inadimplência atual",
        value: money(overdue.vencido),
        detail: `${overdue.qtdVencido} cobrança(s) vencida(s)`,
      },
    ],
    action: { label: "Abrir financeiro", href: `/painel/${slug}/financeiro` },
    notice: financeNotice(summary),
  };
}

async function missingStudentsAnswer(
  parsed: ParsedIntelligenceQuestion,
  session: SessaoAcademia
): Promise<IntelligenceAnswer> {
  if (parsed.period.explicit && isPastPeriod(parsed.period)) {
    return historyUnavailable("missing_students");
  }

  const rows = await getRetencaoAlunos(30);
  const config = configRetencaoDe(session.academia);
  const weight = { sumido: 0, em_risco: 1, atencao: 2, normal: 3 } as const;
  const students = rows
    .map((row) => {
      const status = classificarRetencao(
        { criado_em: row.criado_em, status_matricula: "ativa" },
        row.ultimo_acesso,
        config
      );
      return status ? { ...row, ...status } : null;
    })
    .filter((row): row is NonNullable<typeof row> => !!row && row.classificacao !== "normal")
    .sort(
      (a, b) =>
        weight[a.classificacao] - weight[b.classificacao] ||
        (b.diasSemAcesso ?? b.diasDesdeMatricula) -
          (a.diasSemAcesso ?? a.diasDesdeMatricula)
    );

  return {
    intent: "missing_students",
    title: students.length
      ? `${students.length} aluno(s) precisam de atenção`
      : "Nenhum aluno precisa de atenção agora",
    items: students.slice(0, 5).map((student) => ({
      id: student.aluno_id,
      title: student.nome,
      description: student.explicacao,
      href: `/painel/${session.academia.slug_url}/alunos`,
    })),
    totalItems: students.length,
    action: {
      label: "Ver retenção",
      href: `/painel/${session.academia.slug_url}/retencao`,
    },
    notice: `A academia considera “sumido” a partir de ${config.diasSumido} dias sem acesso.`,
  };
}

async function overdueStudentsAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  if (parsed.period.explicit && isPastPeriod(parsed.period)) {
    return historyUnavailable("overdue_students");
  }
  const result = await getOverdueStudents();
  return {
    intent: "overdue_students",
    title: result.total
      ? `${result.total} aluno(s) estão devendo`
      : "Nenhum aluno está inadimplente",
    description: result.total ? `Total vencido: ${money(result.totalValue)}` : undefined,
    items: result.items.map((item) => ({
      id: item.id,
      title: item.name,
      description: `${money(item.value)} · ${item.daysOverdue} dia(s) de atraso`,
      href: `/painel/${slug}/financeiro/receitas?status=pendente`,
    })),
    totalItems: result.total,
    action: {
      label: "Abrir cobranças",
      href: `/painel/${slug}/financeiro/receitas?status=pendente`,
    },
  };
}

async function expiringPlansAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const result = await getExpiringPlans(parsed.period);
  return {
    intent: "expiring_plans",
    title: result.total
      ? `${result.total} plano(s) com vencimento · ${parsed.period.label}`
      : `Nenhum plano com vencimento · ${parsed.period.label}`,
    period: parsed.period,
    items: result.items.map((item) => ({
      id: item.id,
      title: item.name,
      description: `${item.plan} · ${formatDate(item.dueDate)} · ${money(item.value)}`,
      href: `/painel/${slug}/financeiro/receitas?status=pendente`,
    })),
    totalItems: result.total,
    action: {
      label: "Ver vencimentos",
      href: `/painel/${slug}/financeiro/receitas?status=pendente`,
    },
    notice: "Considera mensalidades pendentes já geradas no GestAcad.",
  };
}

async function attendanceAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const summary = await getOperationalSummary(parsed.period);
  const total = integer(summary.total_checkins);
  const peak = summary.pico_hora === null ? null : integer(summary.pico_hora);
  const metrics = [
    { label: "Check-ins", value: formatNumber(total) },
    {
      label: "Horário de pico",
      value: hourLabel(peak),
      detail: peak === null ? undefined : `${formatNumber(integer(summary.pico_quantidade))} entrada(s)`,
    },
  ];
  return {
    intent: parsed.intent,
    title: `Movimento · ${parsed.period.label}`,
    period: parsed.period,
    metrics:
      parsed.intent === "peak_hour" ? [metrics[1], metrics[0]] : metrics,
    action: { label: "Abrir recepção", href: `/painel/${slug}/recepcao` },
  };
}

async function newStudentsAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const summary = await getOperationalSummary(parsed.period);
  return {
    intent: "new_students",
    title: `Novos alunos · ${parsed.period.label}`,
    period: parsed.period,
    metrics: [
      { label: "Novos alunos", value: formatNumber(integer(summary.novos_alunos)) },
    ],
    action: { label: "Abrir alunos", href: `/painel/${slug}/alunos` },
  };
}

async function activeStudentsAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  if (parsed.period.explicit && isPastPeriod(parsed.period)) {
    return historyUnavailable("active_students");
  }
  const summary = await getOperationalSummary(parsed.period);
  return {
    intent: "active_students",
    title: "Alunos ativos agora",
    metrics: [
      { label: "Matrículas ativas", value: formatNumber(integer(summary.alunos_ativos)) },
    ],
    action: { label: "Abrir alunos", href: `/painel/${slug}/alunos` },
  };
}

async function monthlyGoalAnswer(
  parsed: ParsedIntelligenceQuestion,
  session: SessaoAcademia
): Promise<IntelligenceAnswer> {
  const summary = await getResumoFinanceiro(parsed.period.start, parsed.period.end);
  const revenue = caixaDoResumo(summary).receitaRecebida;
  const goal = Number(session.academia.meta_faturamento_mensal ?? 0);
  if (goal <= 0) {
    return {
      intent: "monthly_goal",
      title: "Meta mensal não configurada",
      description: `Receita recebida em ${parsed.period.label}: ${money(revenue)}.`,
      action: {
        label: "Configurar meta",
        href: `/painel/${session.academia.slug_url}/configuracoes`,
      },
    };
  }
  const progress = Math.min(999, (revenue / goal) * 100);
  return {
    intent: "monthly_goal",
    title: `Meta · ${parsed.period.label}`,
    metrics: [
      { label: "Recebido", value: money(revenue) },
      { label: "Meta", value: money(goal) },
      {
        label: "Progresso",
        value: `${progress.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
        detail: revenue >= goal ? "Meta atingida" : `Faltam ${money(goal - revenue)}`,
      },
    ],
    action: { label: "Abrir financeiro", href: `/painel/${session.academia.slug_url}/financeiro` },
    notice: isPastPeriod(parsed.period)
      ? "A meta configurada não possui histórico de alterações; o valor atual foi aplicado a este período."
      : financeNotice(summary),
  };
}

async function businessSummaryAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const [financial, operational] = await Promise.all([
    getResumoFinanceiro(parsed.period.start, parsed.period.end),
    getOperationalSummary(parsed.period),
  ]);
  const cash = caixaDoResumo(financial);
  const historical = isPastPeriod(parsed.period);
  return {
    intent: "business_summary",
    title: parsed.period.label,
    period: parsed.period,
    metrics: [
      { label: "Receita", value: money(cash.receitaRecebida) },
      { label: "Check-ins", value: formatNumber(integer(operational.total_checkins)) },
      { label: "Novos alunos", value: formatNumber(integer(operational.novos_alunos)) },
      ...(!historical
        ? [{ label: "Alunos ativos", value: formatNumber(integer(operational.alunos_ativos)) }]
        : []),
    ],
    action: { label: "Ver relatórios", href: `/painel/${slug}/dashboard` },
    notice: joinNotices(
      historical
        ? "Alunos ativos e inadimplência não aparecem porque o banco não guarda uma fotografia completa desses estados no passado."
        : undefined,
      financeNotice(financial)
    ),
  };
}

async function comparePeriodsAnswer(
  parsed: ParsedIntelligenceQuestion,
  slug: string
): Promise<IntelligenceAnswer> {
  const comparison = parsed.comparison!;
  const [financeA, financeB, opsA, opsB] = await Promise.all([
    getResumoFinanceiro(comparison.periodA.start, comparison.periodA.end),
    getResumoFinanceiro(comparison.periodB.start, comparison.periodB.end),
    getOperationalSummary(comparison.periodA),
    getOperationalSummary(comparison.periodB),
  ]);
  const cashA = caixaDoResumo(financeA);
  const cashB = caixaDoResumo(financeB);
  const checksA = integer(opsA.total_checkins);
  const checksB = integer(opsB.total_checkins);
  const newA = integer(opsA.novos_alunos);
  const newB = integer(opsB.novos_alunos);
  return {
    intent: "compare_periods",
    title: `${comparison.periodA.label} x ${comparison.periodB.label}`,
    metrics: [
      {
        label: "Receita",
        value: money(cashA.receitaRecebida),
        detail: `${comparison.periodB.label}: ${money(cashB.receitaRecebida)}`,
        delta: delta(cashA.receitaRecebida, cashB.receitaRecebida),
      },
      {
        label: "Check-ins",
        value: formatNumber(checksA),
        detail: `${comparison.periodB.label}: ${formatNumber(checksB)}`,
        delta: delta(checksA, checksB),
      },
      {
        label: "Novos alunos",
        value: formatNumber(newA),
        detail: `${comparison.periodB.label}: ${formatNumber(newB)}`,
        delta:
          newB === 0
            ? undefined
            : {
                label: `${newA - newB >= 0 ? "+" : ""}${newA - newB}`,
                sentiment: newA === newB ? "neutral" : newA > newB ? "positive" : "negative",
              },
      },
    ],
    action: { label: "Ver relatórios", href: `/painel/${slug}/dashboard` },
    notice: joinNotices(
      "Inadimplência não entra na comparação porque o banco atual não guarda uma fotografia confiável desse estado em cada período.",
      financeNotice(financeA),
      financeNotice(financeB)
    ),
  };
}

export async function answerIntelligenceQuestion(
  parsed: ParsedIntelligenceQuestion,
  session: SessaoAcademia
): Promise<IntelligenceAnswer> {
  const slug = session.academia.slug_url;
  switch (parsed.intent) {
    case "revenue":
      return revenueAnswer(parsed, slug);
    case "financial_summary":
      return financialSummaryAnswer(parsed, slug);
    case "missing_students":
      return missingStudentsAnswer(parsed, session);
    case "overdue_students":
      return overdueStudentsAnswer(parsed, slug);
    case "expiring_plans":
      return expiringPlansAnswer(parsed, slug);
    case "checkins":
    case "attendance_summary":
    case "peak_hour":
      return attendanceAnswer(parsed, slug);
    case "new_students":
      return newStudentsAnswer(parsed, slug);
    case "active_students":
      return activeStudentsAnswer(parsed, slug);
    case "monthly_goal":
      return monthlyGoalAnswer(parsed, session);
    case "business_summary":
      return businessSummaryAnswer(parsed, slug);
    case "compare_periods":
      return comparePeriodsAnswer(parsed, slug);
    default:
      return unknownAnswer();
  }
}
