import { parseComparisonPeriods, parseDateRange } from "./date-range";
import { detectIntent } from "./intents";
import { normalizeQuestion } from "./normalize";
import { ParsedIntelligenceQuestion } from "./types";

export function parseIntelligenceQuestion(
  question: string,
  todayIso?: string
): ParsedIntelligenceQuestion {
  const normalized = normalizeQuestion(question);
  const intent = detectIntent(normalized);
  const comparison =
    intent === "compare_periods"
      ? parseComparisonPeriods(normalized, todayIso)
      : undefined;
  const period = comparison?.periodA ?? parseDateRange(normalized, intent, todayIso);

  return { normalized, intent, period, comparison };
}

