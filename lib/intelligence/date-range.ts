import { hojeSaoPaulo } from "../utils";
import { normalizeQuestion } from "./normalize";
import {
  IntelligenceComparison,
  IntelligenceIntent,
  IntelligencePeriod,
} from "./types";

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const MONTH_NAMES = Object.keys(MONTHS);

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number): string {
  const date = localDate(value);
  date.setDate(date.getDate() + amount);
  return iso(date);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDay(value: string): string {
  return localDate(value).toLocaleDateString("pt-BR");
}

function formatRange(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} a ${formatDay(end)}`;
}

function monthPeriod(
  year: number,
  month: number,
  explicit: boolean
): IntelligencePeriod {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: iso(start),
    end: iso(end),
    label: `${capitalize(MONTH_NAMES[month])} de ${year}`,
    kind: "month",
    explicit,
  };
}

function dayPeriod(
  date: string,
  label: string,
  explicit: boolean
): IntelligencePeriod {
  return { start: date, end: date, label, kind: "day", explicit };
}

function currentMonth(today: string, explicit: boolean): IntelligencePeriod {
  const date = localDate(today);
  return monthPeriod(date.getFullYear(), date.getMonth(), explicit);
}

function previousMonth(today: string, explicit: boolean): IntelligencePeriod {
  const date = localDate(today);
  return monthPeriod(date.getFullYear(), date.getMonth() - 1, explicit);
}

function inferYear(
  month: number,
  explicitYear: string | undefined,
  today: Date
): number {
  if (explicitYear) {
    const parsed = Number(explicitYear);
    return parsed < 100 ? 2000 + parsed : parsed;
  }
  return month > today.getMonth() ? today.getFullYear() - 1 : today.getFullYear();
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseNumericRange(
  question: string,
  today: Date
): IntelligencePeriod | null {
  const match = question.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:a|ate|e|-)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/
  );
  if (!match) return null;

  const startMonth = Number(match[2]) - 1;
  const endMonth = Number(match[5]) - 1;
  let startYear = inferYear(startMonth, match[3], today);
  let endYear = match[6]
    ? inferYear(endMonth, match[6], today)
    : startYear;

  if (!match[6] && endMonth < startMonth) endYear += 1;

  let startDate = validDate(startYear, startMonth, Number(match[1]));
  let endDate = validDate(endYear, endMonth, Number(match[4]));
  if (!startDate || !endDate) return null;

  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  const start = iso(startDate);
  const end = iso(endDate);
  return {
    start,
    end,
    label: formatRange(start, end),
    kind: "custom",
    explicit: true,
  };
}

function parseSingleNumericDate(
  question: string,
  today: Date
): IntelligencePeriod | null {
  const match = question.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!match) return null;
  const month = Number(match[2]) - 1;
  const year = inferYear(month, match[3], today);
  const date = validDate(year, month, Number(match[1]));
  if (!date) return null;
  const value = iso(date);
  return dayPeriod(value, formatDay(value), true);
}

function parseNamedMonth(
  question: string,
  today: Date
): IntelligencePeriod | null {
  const monthPattern = MONTH_NAMES.join("|");
  const match = question.match(
    new RegExp(`\\b(${monthPattern})\\b(?:\\s+(?:de\\s+)?(\\d{4}))?`)
  );
  if (!match) return null;
  const month = MONTHS[match[1]];
  return monthPeriod(inferYear(month, match[2], today), month, true);
}

function parseRelative(
  question: string,
  todayIso: string
): IntelligencePeriod | null {
  const today = localDate(todayIso);

  if (/\banteontem\b/.test(question)) {
    const value = addDays(todayIso, -2);
    return dayPeriod(value, "Anteontem", true);
  }
  if (/\bontem\b/.test(question)) {
    const value = addDays(todayIso, -1);
    return dayPeriod(value, "Ontem", true);
  }
  if (/\bhoje\b/.test(question)) return dayPeriod(todayIso, "Hoje", true);

  const rolling = question.match(/\bultimos?\s+(\d{1,3})\s+dias?\b/);
  if (rolling) {
    const days = Math.min(366, Math.max(1, Number(rolling[1])));
    return {
      start: addDays(todayIso, -(days - 1)),
      end: todayIso,
      label: `Últimos ${days} dias`,
      kind: "rolling",
      explicit: true,
    };
  }

  const upcoming = question.match(/\bproximos?\s+(\d{1,3})\s+dias?\b/);
  if (upcoming) {
    const days = Math.min(366, Math.max(1, Number(upcoming[1])));
    return {
      start: todayIso,
      end: addDays(todayIso, days - 1),
      label: `Próximos ${days} dias`,
      kind: "rolling",
      explicit: true,
    };
  }

  if (/\bsemana passada\b/.test(question)) {
    const weekday = (today.getDay() + 6) % 7;
    const currentMonday = addDays(todayIso, -weekday);
    const start = addDays(currentMonday, -7);
    const end = addDays(currentMonday, -1);
    return { start, end, label: "Semana passada", kind: "week", explicit: true };
  }

  if (/\b(?:esta|essa) semana\b/.test(question)) {
    const weekday = (today.getDay() + 6) % 7;
    const start = addDays(todayIso, -weekday);
    const end = addDays(start, 6);
    return { start, end, label: "Esta semana", kind: "week", explicit: true };
  }

  if (/\bmes passado\b/.test(question)) return previousMonth(todayIso, true);
  if (/\b(?:este|esse) mes\b/.test(question)) return currentMonth(todayIso, true);

  return null;
}

function defaultPeriod(
  intent: IntelligenceIntent,
  today: string
): IntelligencePeriod {
  if (
    intent === "checkins" ||
    intent === "attendance_summary" ||
    intent === "peak_hour"
  ) {
    return dayPeriod(today, "Hoje", false);
  }

  if (intent === "expiring_plans") {
    return {
      start: today,
      end: addDays(today, 6),
      label: "Próximos 7 dias",
      kind: "rolling",
      explicit: false,
    };
  }

  if (
    intent === "missing_students" ||
    intent === "overdue_students" ||
    intent === "active_students"
  ) {
    return {
      start: today,
      end: today,
      label: "Situação atual",
      kind: "current",
      explicit: false,
    };
  }

  return currentMonth(today, false);
}

/** Interpreta um período em português brasileiro sem executar texto do usuário. */
export function parseDateRange(
  question: string,
  intent: IntelligenceIntent,
  todayIso = hojeSaoPaulo()
): IntelligencePeriod {
  const normalized = normalizeQuestion(question);
  const today = localDate(todayIso);
  return (
    parseNumericRange(normalized, today) ??
    parseRelative(normalized, todayIso) ??
    parseNamedMonth(normalized, today) ??
    parseSingleNumericDate(normalized, today) ??
    defaultPeriod(intent, todayIso)
  );
}

/** Período imediatamente anterior, com o mesmo formato e duração. */
export function previousPeriod(period: IntelligencePeriod): IntelligencePeriod {
  if (period.kind === "month") {
    const date = localDate(period.start);
    return monthPeriod(date.getFullYear(), date.getMonth() - 1, true);
  }

  const duration =
    Math.round(
      (localDate(period.end).getTime() - localDate(period.start).getTime()) /
        86_400_000
    ) + 1;
  const end = addDays(period.start, -1);
  const start = addDays(end, -(duration - 1));
  return {
    start,
    end,
    label: formatRange(start, end),
    kind: period.kind === "day" ? "day" : "custom",
    explicit: true,
  };
}

/** Reconhece "julho vs junho" e variações com "compare ... com ...". */
export function parseComparisonPeriods(
  question: string,
  todayIso = hojeSaoPaulo()
): IntelligenceComparison {
  const normalized = normalizeQuestion(question).replace(/^compare\s+/, "");
  const separator = normalized.match(/\s+(?:vs|versus|x|com)\s+/);

  if (separator?.index !== undefined) {
    const left = normalized.slice(0, separator.index).trim();
    const right = normalized
      .slice(separator.index + separator[0].length)
      .trim();
    const periodA = parseDateRange(left, "business_summary", todayIso);
    const periodB = /\b(?:anterior|mes passado)\b/.test(right)
      ? previousPeriod(periodA)
      : parseDateRange(right, "business_summary", todayIso);
    return { periodA, periodB };
  }

  const periodA = currentMonth(todayIso, true);
  return { periodA, periodB: previousPeriod(periodA) };
}

export function isPastPeriod(
  period: IntelligencePeriod,
  todayIso = hojeSaoPaulo()
): boolean {
  return period.end < todayIso;
}
