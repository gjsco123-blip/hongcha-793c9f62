export interface ExamBlockLike {
  one_sentence_summary?: string;
  one_sentence_summary_ko?: string;
  one_sentence_summary_en_hidden?: string;
  summary_keywords?: unknown;
}

const EASY_WORDS = new Set([
  "act",
  "allow",
  "before",
  "belong",
  "care",
  "citizen",
  "citizens",
  "community",
  "control",
  "discover",
  "everyone",
  "gather",
  "give",
  "hold",
  "immediate",
  "information",
  "internet",
  "journalism",
  "journalist",
  "journalists",
  "know",
  "local",
  "making",
  "more",
  "news",
  "organization",
  "organizations",
  "people",
  "place",
  "places",
  "power",
  "problem",
  "professional",
  "relevant",
  "responsibility",
  "self",
  "solve",
  "take",
  "technology",
  "tell",
  "traditional",
  "up",
]);

function parseKeyword(keyword: string): { word: string; meaning: string } | null {
  const [rawWord, ...rest] = keyword.split(":");
  const word = rawWord?.trim().toLowerCase() || "";
  const meaning = rest.join(":").trim();
  if (!word || !meaning) return null;
  return { word, meaning };
}

function isSingleVocabWord(word: string): boolean {
  return /^[a-z][a-z-]*$/.test(word);
}

function isTooEasyWord(word: string): boolean {
  return word.length <= 3 || EASY_WORDS.has(word);
}

function keywordLooksRelevant(keyword: string, sourceText: string, allowEasyWords = false): boolean {
  const parsed = parseKeyword(keyword);
  if (!parsed) return false;
  if (!isSingleVocabWord(parsed.word)) return false;
  if (!allowEasyWords && isTooEasyWord(parsed.word)) return false;

  const source = sourceText.toLowerCase();
  return source.includes(parsed.word);
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
  const unique = Array.from(new Set(normalized));
  const preferred = unique.filter((keyword) => keywordLooksRelevant(keyword, sourceText));

  if (preferred.length >= 5) {
    return preferred.slice(0, Math.min(6, preferred.length));
  }

  const fallback = unique.filter(
    (keyword) => !preferred.includes(keyword) && keywordLooksRelevant(keyword, sourceText, true),
  );

  const merged = [...preferred, ...fallback];
  if (merged.length >= 5) {
    return merged.slice(0, Math.min(6, merged.length));
  }

  return merged.slice(0, Math.min(4, merged.length));
}

export function getDisplaySummary(block: ExamBlockLike | null | undefined): string {
  if (!block) return "";
  return (block.one_sentence_summary_ko || block.one_sentence_summary || "").trim();
}

function getKeywordSourceText(block: ExamBlockLike, fallbackText?: string): string {
  return (block.one_sentence_summary_en_hidden || fallbackText || "").trim();
}

export function normalizeExamBlock<T extends ExamBlockLike | null | undefined>(
  block: T,
  fallbackText?: string,
): T {
  if (!block) return block;
  const keywordSource = getKeywordSourceText(block, fallbackText);
  return {
    ...block,
    summary_keywords: keywordSource
      ? filterSummaryKeywordsBySource(block.summary_keywords, keywordSource)
      : normalizeSummaryKeywords(block.summary_keywords),
  } as T;
}
