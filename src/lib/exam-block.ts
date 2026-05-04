export interface ExamBlockLike {
  one_sentence_summary?: string;
  one_sentence_summary_ko?: string;
  summary_keywords?: unknown;
}

function keywordLooksRelevant(keyword: string, sourceText: string): boolean {
  const englishPart = keyword.split(":")[0]?.trim().toLowerCase() || "";
  if (!englishPart) return false;

  const words = englishPart.match(/[a-z][a-z-]*/g) || [];
  if (words.length === 0) return false;

  const source = sourceText.toLowerCase();
  return words.every((word) => source.includes(word));
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

export function filterSummaryKeywordsBySource(value: unknown, sourceText: string): string[] {
  const normalized = normalizeSummaryKeywords(value);
  if (!sourceText.trim()) return normalized;
  return normalized.filter((keyword) => keywordLooksRelevant(keyword, sourceText));
}

export function getDisplaySummary(block: ExamBlockLike | null | undefined): string {
  if (!block) return "";
  return (block.one_sentence_summary_ko || block.one_sentence_summary || "").trim();
}

export function normalizeExamBlock<T extends ExamBlockLike | null | undefined>(
  block: T,
  sourceText?: string,
): T {
  if (!block) return block;
  return {
    ...block,
    summary_keywords: sourceText
      ? filterSummaryKeywordsBySource(block.summary_keywords, sourceText)
      : normalizeSummaryKeywords(block.summary_keywords),
  } as T;
}
