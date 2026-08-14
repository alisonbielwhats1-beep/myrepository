export type IntelligenceIntent =
  | "revenue"
  | "financial_summary"
  | "missing_students"
  | "overdue_students"
  | "expiring_plans"
  | "checkins"
  | "new_students"
  | "active_students"
  | "attendance_summary"
  | "peak_hour"
  | "monthly_goal"
  | "business_summary"
  | "compare_periods"
  | "unknown";

export type PeriodKind =
  | "day"
  | "week"
  | "month"
  | "rolling"
  | "custom"
  | "current";

export interface IntelligencePeriod {
  start: string;
  end: string;
  label: string;
  kind: PeriodKind;
  explicit: boolean;
}

export interface IntelligenceComparison {
  periodA: IntelligencePeriod;
  periodB: IntelligencePeriod;
}

export type IntelligenceSentiment = "positive" | "negative" | "neutral";

export interface IntelligenceDelta {
  label: string;
  sentiment: IntelligenceSentiment;
}

export interface IntelligenceMetric {
  label: string;
  value: string;
  detail?: string;
  delta?: IntelligenceDelta;
}

export interface IntelligenceItem {
  id: string;
  title: string;
  description: string;
  href?: string;
}

export interface IntelligenceAction {
  label: string;
  href: string;
}

export interface IntelligenceAnswer {
  intent: IntelligenceIntent;
  title: string;
  description?: string;
  period?: IntelligencePeriod;
  metrics?: IntelligenceMetric[];
  items?: IntelligenceItem[];
  totalItems?: number;
  action?: IntelligenceAction;
  notice?: string;
  suggestions?: string[];
}

export interface ParsedIntelligenceQuestion {
  normalized: string;
  intent: IntelligenceIntent;
  period: IntelligencePeriod;
  comparison?: IntelligenceComparison;
}

