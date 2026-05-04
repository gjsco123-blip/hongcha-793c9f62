export interface ExamBlockLike {
  one_sentence_summary?: string;
  one_sentence_summary_ko?: string;
  one_sentence_summary_en_hidden?: string;
  summary_keywords?: unknown;
  summary_keyword_basis?: unknown;
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

function normalizeWordForm(word: string): string[] {
  const lower = word.toLowerCase();
  const forms = new Set<string>([lower]);

  if (lower.endsWith("ies") && lower.length > 4) {
    forms.add(`${lower.slice(0, -3)}y`);
  }
  if (lower.endsWith("es") && lower.length > 4) {
    forms.add(lower.slice(0, -2));
  }
  if (lower.endsWith("s") && lower.length > 3) {
    forms.add(lower.slice(0, -1));
  }
  if (lower.endsWith("ied") && lower.length > 4) {
    forms.add(`${lower.slice(0, -3)}y`);
  }
  if (lower.endsWith("ed") && lower.length > 4) {
    forms.add(lower.slice(0, -2));
    forms.add(lower.slice(0, -1));
  }
  if (lower.endsWith("ing") && lower.length > 5) {
    forms.add(lower.slice(0, -3));
    forms.add(`${lower.slice(0, -3)}e`);
  }

  return Array.from(forms).filter(Boolean);
}

function buildSourceWordSet(sourceText: string): Set<string> {
  const tokens = sourceText.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) || [];
  const words = new Set<string>();
  for (const token of tokens) {
    for (const form of normalizeWordForm(token)) {
      words.add(form);
    }
  }
  return words;
}

function keywordLooksRelevant(keyword: string, sourceWords: Set<string>, allowEasyWords = false): boolean {
  const parsed = parseKeyword(keyword);
  if (!parsed) return false;
  if (!isSingleVocabWord(parsed.word)) return false;
  if (!allowEasyWords && isTooEasyWord(parsed.word)) return false;
  return normalizeWordForm(parsed.word).some((form) => sourceWords.has(form));
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

function normalizeSummaryKeywordBasis(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

export function formatSummaryKeywords(value: unknown): string {
  return normalizeSummaryKeywords(value).join(" / ");
}

export function filterSummaryKeywordsBySource(
  value: unknown,
  sourceText: string,
  summaryText?: string,
  basisValue?: unknown,
): string[] {
  const normalized = normalizeSummaryKeywords(value);
  if (!sourceText.trim()) return normalized;
  const basis = normalizeSummaryKeywordBasis(basisValue);
  const sourceWords = buildSourceWordSet(sourceText);
  const unique = Array.from(new Set(normalized));
  const aligned = unique
    .map((keyword, index) => ({ keyword, basis: basis[index] || "" }))
    .filter(({ basis }) => !summaryText || !basis || summaryText.includes(basis));
  const preferred = aligned
    .filter(({ keyword }) => keywordLooksRelevant(keyword, sourceWords))
    .map(({ keyword }) => keyword);

  if (preferred.length >= 5) {
    return preferred.slice(0, Math.min(6, preferred.length));
  }

  const fallback = aligned
    .filter(({ keyword }) => !preferred.includes(keyword) && keywordLooksRelevant(keyword, sourceWords, true))
    .map(({ keyword }) => keyword);

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
): T {
  if (!block) return block;
  const keywordSource = getKeywordSourceText(block);
  const summaryText = getDisplaySummary(block);
  return {
    ...block,
    summary_keyword_basis: normalizeSummaryKeywordBasis(block.summary_keyword_basis),
    summary_keywords: keywordSource
      ? filterSummaryKeywordsBySource(block.summary_keywords, keywordSource, summaryText, block.summary_keyword_basis)
      : normalizeSummaryKeywords(block.summary_keywords),
  } as T;
}
