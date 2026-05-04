export interface ExamBlockLike {
  one_sentence_summary?: string;
  one_sentence_summary_ko?: string;
  summary_keywords?: unknown;
}

export function normalizeSummaryKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("/")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function formatSummaryKeywords(value: unknown): string {
  return normalizeSummaryKeywords(value).join(" / ");
}

export function getDisplaySummary(block: ExamBlockLike | null | undefined): string {
  if (!block) return "";
  return (block.one_sentence_summary_ko || block.one_sentence_summary || "").trim();
}

export function normalizeExamBlock<T extends ExamBlockLike | null | undefined>(block: T): T {
  if (!block) return block;
  return {
    ...block,
    summary_keywords: normalizeSummaryKeywords(block.summary_keywords),
  } as T;
}
