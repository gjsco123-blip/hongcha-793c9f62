import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TagId =
  | "REL_SUBJ"
  | "REL_OBJ_OMIT"
  | "REL_ADV"
  | "AGREEMENT"
  | "NOUN_CLAUSE_THAT"
  | "NOUN_CLAUSE_WH"
  | "IT_DUMMY_SUBJ"
  | "IT_DUMMY_OBJ"
  | "FIVE_PATTERN"
  | "TO_INF"
  | "PARTICIPLE_POST"
  | "PARTICIPLE_CLAUSE"
  | "PASSIVE"
  | "MODAL_PASSIVE"
  | "PARALLEL"
  | "PREP_GERUND"
  | "THERE_BE"
  | "COMPARISON"
  | "OMISSION";

type GrammarResponse = {
  syntaxNotes: string;
  detectedTags?: TagId[];
  normalizedHint?: string;
};

type PinnedPatternsData = {
  promptBlock: string;
  byTag: Map<string, string>;
};

function shouldForcePinnedTemplateForSentence(template: string, sentence?: string): boolean {
  const templateText = oneLine(template || "");
  const sentenceText = oneLine(sentence || "").toLowerCase();
  if (!templateText || !sentenceText) return false;

  const keywords = extractEnglishKeywords(templateText);
  if (keywords.length === 0) return false;

  return keywords.every((kw) => sentenceText.includes(kw));
}

function oneLine(s: string) {
  return String(s ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string) {
  return oneLine(text).split(" ").filter(Boolean).length;
}

function extractEnglishKeywords(content: string): string[] {
  const matches = content.match(/[A-Za-z][A-Za-z'\-]{1,}/g) || [];
  const stopWords = new Set([
    // articles & determiners
    "the", "a", "an", "this", "that", "these", "those", "some", "any", "such",
    // be verbs
    "is", "are", "was", "were", "be", "been", "being", "am",
    // prepositions
    "to", "of", "in", "for", "on", "at", "by", "with", "from", "into", "about",
    "between", "through", "during", "before", "after", "above", "below", "over", "under",
    // conjunctions & connectors
    "and", "or", "but", "nor", "so", "yet", "if", "when", "while", "because",
    // pronouns
    "it", "its", "he", "she", "they", "them", "their", "we", "us", "our", "you", "your",
    "him", "her", "his", "my", "me", "who", "whom", "whose", "which",
    // common verbs
    "do", "does", "did", "has", "had", "have", "can", "may", "will", "would",
    "could", "should", "might", "must", "shall",
    // adverbs & misc high-frequency
    "not", "no", "up", "out", "also", "just", "very", "much", "more", "most",
    "even", "still", "only", "rather", "than", "too", "well", "then", "now",
    "here", "there", "where", "how", "what", "why", "all", "each", "every",
    "both", "either", "neither", "other", "another", "own", "same",
    // common adjectives
    "new", "old", "good", "bad", "great", "first", "last", "long", "little", "big",
  ]);

  return matches
    .map((m) => m.toLowerCase())
    .filter((m) => m.length >= 3 && !stopWords.has(m));
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = String(raw ?? "")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Failed to parse model JSON");
  }
}

function sanitizeEndings(text: string): string {
  return String(text ?? "")
    .replace(/역할임(?=[.\s/,)~]|$)/g, "역할")
    .replace(/구조임(?=[.\s/,)~]|$)/g, "구조")
    .replace(/의미임(?=[.\s/,)~]|$)/g, "의미")
    .replace(/수일치함(?=[.\s/,)~]|$)/g, "수일치")
    .replace(/수동의 의미임(?=[.\s/,)~]|$)/g, "수동의 의미")
    .replace(/목적격 보어 역할임(?=[.\s/,)~]|$)/g, "목적격 보어 역할");
}

function repairTruncatedSyntaxPhrases(text: string): string {
  let out = String(text ?? "");
  // Keep common intended form "쓰임" if model output got clipped to "쓰".
  out = out.replace(/구동사로\s*쓰(?=\s*(?:\/|$))/g, "구동사로 쓰임");
  out = out.replace(/표현으로\s*쓰(?=\s*(?:\/|$))/g, "표현으로 쓰임");
  out = out.replace(/구조로\s*쓰(?=\s*(?:\/|$))/g, "구조로 쓰임");
  out = out.replace(/용법으로\s*쓰(?=\s*(?:\/|$))/g, "용법으로 쓰임");
  out = out.replace(/((?:[가-힣A-Za-z]+\s+){0,2}용법)으로\s*쓰(?=\s*(?:\/|$))/g, "$1으로 쓰임");
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

function stripLeadingBullets(line: string) {
  return String(line ?? "")
    .replace(/^(\s*[\u2460-\u2473])\s*[•·\-\*]\s*/u, "$1 ")
    .replace(/^(\s*\d+[\)\.])\s*[•·\-\*]\s*/u, "$1 ")
    .replace(/^\s*[•·\-\*]\s*/u, "")
    .trim();
}

const TAG_PREFIX_LABELS = [
  "관계대명사",
  "관계부사",
  "분사구문",
  "분사 후치수식",
  "수동태",
  "조동사+수동",
  "to부정사",
  "명사절",
  "가주어/진주어",
  "가목적어/진목적어",
  "5형식",
  "병렬구조",
  "전치사+동명사",
  "비교구문",
  "수일치",
  "생략",
  "지칭",
  "숙어/표현",
  "기타",
];

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TAG_PREFIX_RE = new RegExp(
  `^\\s*(?:[•·\\-*]\\s*)?(?:\\d+[\\).]\\s*)?(?:${TAG_PREFIX_LABELS.map(escapeRegex).join("|")})\\s*:\\s*`,
  "u"
);

function stripLeadingTagLabel(line: string) {
  let out = String(line ?? "").replace(TAG_PREFIX_RE, "").trim();

  // Fallback: strip custom Korean classifier prefixes such as "지칭:".
  out = out.replace(/^([가-힣][가-힣A-Za-z0-9_+/\-\s]{0,24})\s*:\s*/u, "").trim();
  // Fallback: strip uppercase tag-like prefixes such as "REL_SUBJ:".
  out = out.replace(/^([A-Z][A-Z0-9_+/\-\s]{1,24})\s*:\s*/, "").trim();

  return out;
}

function stripTrailingFieldLabel(line: string) {
  return String(line ?? "")
    .replace(/,\s*"?tag"?\s*:\s*$/gi, "")
    .replace(/\s*"?tag"?\s*:\s*$/gi, "")
    .replace(/,\s*"?finish_reason"?\s*:\s*$/gi, "")
    .replace(/\s*"?finish_reason"?\s*:\s*$/gi, "")
    .replace(/\s*[A-Za-z0-9_]*assistant[A-Za-z0-9_]*syntax[A-Za-z0-9_]*points?:tag:\s*$/gi, "")
    .replace(/\s*[A-Za-z0-9_]*syntax[A-Za-z0-9_]*result[A-Za-z0-9_]*points?:tag:\s*$/gi, "")
    .replace(/\s*[A-Za-z0-9_]+(?:_[A-Za-z0-9_]+){2,}:tag:\s*$/g, "")
    .trim();
}

function detectLeadingTagLabel(line: string): string {
  const text = String(line ?? "").trim();
  if (!text) return "";
  for (const label of TAG_PREFIX_LABELS) {
    const re = new RegExp(
      `^\\s*(?:[•·\\-*]\\s*)?(?:\\d+[\\).]\\s*)?${escapeRegex(label)}\\s*:`,
      "u"
    );
    if (re.test(text)) return label;
  }
  return "";
}

function finalizeSyntaxText(text: string): string {
  let out = oneLine(text);
  for (let i = 0; i < 3; i += 1) {
    const next = stripLeadingTagLabel(
      stripTrailingFieldLabel(
        repairTruncatedSyntaxPhrases(
          sanitizeEndings(
            stripLeadingBullets(out)
          )
        )
      )
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

function formatAsLines(points: string[], maxLines: number) {
  const cleaned = points
    .map(finalizeSyntaxText)
    .filter(Boolean);

  return cleaned.slice(0, maxLines).join("\n");
}

// -----------------------------
// 태그 규칙
// -----------------------------
const TAG_RULES: Array<{
  id: TagId;
  keywords: string[];
  label: string;
}> = [
  { id: "REL_SUBJ", keywords: ["주격관계대명사", "주관대", "who", "which", "that(주격)"], label: "주격 관계대명사" },
  {
    id: "REL_OBJ_OMIT",
    keywords: ["목적격관계대명사", "목관대", "관계대명사 생략", "목적격 생략", "that 생략", "which 생략"],
    label: "목적격 관계대명사(생략)",
  },
  { id: "REL_ADV", keywords: ["관계부사", "when", "where", "why", "how(관계부사)"], label: "관계부사" },
  { id: "AGREEMENT", keywords: ["수일치", "단수", "복수", "동사 수일치"], label: "수일치" },
  {
    id: "NOUN_CLAUSE_THAT",
    keywords: ["명사절 that", "that절", "that 명사절", "that 생략"],
    label: "명사절 that(생략)",
  },
  {
    id: "NOUN_CLAUSE_WH",
    keywords: ["의문사절", "간접의문문", "what절", "how절", "why절", "which절", "whether절", "if절(명사절)"],
    label: "의문사절/간접의문문",
  },
  {
    id: "IT_DUMMY_SUBJ",
    keywords: ["가주어", "진주어", "it 가주어", "to부정사 진주어", "that절 진주어"],
    label: "가주어/진주어",
  },
  { id: "IT_DUMMY_OBJ", keywords: ["가목적어", "진목적어", "it 가목적어"], label: "가목적어/진목적어" },
  { id: "FIVE_PATTERN", keywords: ["5형식", "목적격보어", "o.c", "oc", "make o c", "find o c"], label: "5형식(O.C)" },
  {
    id: "TO_INF",
    keywords: ["to부정사", "to-v", "to v", "to부정사 용법", "to부정사 목적", "to부정사 형용사적", "to부정사 부사적"],
    label: "to부정사",
  },
  {
    id: "PARTICIPLE_POST",
    keywords: ["과거분사", "현재분사", "분사 후치", "후치수식", "p.p", "v-ing(형용사)", "분사구"],
    label: "분사 후치수식",
  },
  {
    id: "PARTICIPLE_CLAUSE",
    keywords: ["분사구문", "접속사 생략", "분사구문(이유)", "분사구문(시간)", "분사구문(양보)"],
    label: "분사구문",
  },
  { id: "PASSIVE", keywords: ["수동태", "be p.p", "be pp", "수동"], label: "수동태" },
  {
    id: "MODAL_PASSIVE",
    keywords: ["조동사+수동", "can be p.p", "may be p.p", "must be p.p", "will be p.p"],
    label: "조동사+수동",
  },
  { id: "PARALLEL", keywords: ["병렬", "and 병렬", "or 병렬", "not only", "both", "either", "neither"], label: "병렬" },
  {
    id: "PREP_GERUND",
    keywords: ["전치사+동명사", "by ~ing", "in ~ing", "for ~ing", "without ~ing"],
    label: "전치사+동명사",
  },
  { id: "THERE_BE", keywords: ["there is", "there are", "There is/are", "유도부사"], label: "There is/are" },
  { id: "COMPARISON", keywords: ["비교급", "최상급", "as ~ as", "than", "the 비교급", "비교"], label: "비교구문" },
  { id: "OMISSION", keywords: ["생략", "that 생략", "관계사 생략", "접속사 생략"], label: "생략" },
];

function detectTagsFromHint(userHint: string): TagId[] {
  const h = oneLine(userHint).toLowerCase();
  if (!h) return [];
  const found: TagId[] = [];
  for (const rule of TAG_RULES) {
    const hit = rule.keywords.some((k) => h.includes(k.toLowerCase()));
    if (hit) found.push(rule.id);
  }
  return Array.from(new Set(found));
}

function tagsToPromptBlock(tags: TagId[]) {
  const map = new Map<TagId, string>();
  for (const r of TAG_RULES) map.set(r.id, r.label);
  return tags.map((t) => `${t}: ${map.get(t) ?? t}`).join("\n");
}

function normalizeTagKey(s: string): string {
  return oneLine(s).toLowerCase().replace(/\s+/g, "");
}

function mapTagIdToUiTag(tagId: TagId): string {
  switch (tagId) {
    case "REL_SUBJ":
    case "REL_OBJ_OMIT":
      return "관계대명사";
    case "REL_ADV":
      return "관계부사";
    case "AGREEMENT":
      return "수일치";
    case "NOUN_CLAUSE_THAT":
    case "NOUN_CLAUSE_WH":
      return "명사절";
    case "IT_DUMMY_SUBJ":
      return "가주어/진주어";
    case "IT_DUMMY_OBJ":
      return "가목적어/진목적어";
    case "FIVE_PATTERN":
      return "5형식";
    case "TO_INF":
      return "to부정사";
    case "PARTICIPLE_POST":
      return "분사 후치수식";
    case "PARTICIPLE_CLAUSE":
      return "분사구문";
    case "PASSIVE":
      return "수동태";
    case "MODAL_PASSIVE":
      return "조동사+수동";
    case "PARALLEL":
      return "병렬구조";
    case "PREP_GERUND":
      return "전치사+동명사";
    case "COMPARISON":
      return "비교구문";
    case "OMISSION":
      return "생략";
    default:
      return "기타";
  }
}

function detectUiTagFromContent(content: string): string {
  const c = oneLine(content).toLowerCase();
  if (c.includes("동격") && (c.includes("접속사") || c.includes("that") || c.includes("동격접"))) return "동격접";
  if (c.includes("관계사")) {
    if (c.includes("계속적") && (c.includes("용법") || c.includes("관계"))) return "계속적용법 관계대명사";
    if (c.includes("where") || c.includes("when") || c.includes("why") || c.includes("how")) return "관계부사";
    return "관계대명사";
  }
  if (c.includes("관계대명사") || c.includes("주관대") || c.includes("목관대")) return "관계대명사";
  if (c.includes("관계부사")) return "관계부사";
  if (c.includes("분사구문")) return "분사구문";
  if (c.includes("후치수식") || c.includes("후치")) return "분사 후치수식";
  if (c.includes("조동사") && c.includes("수동")) return "조동사+수동";
  if (c.includes("현재완료") && c.includes("수동")) return "현재완료+수동";
  if (c.includes("수동태") || c.includes("be p.p") || c.includes("to be pp") || c.includes("to be p.p")) return "수동태";
  if (c.includes("to부정사") || c.includes("to-v")) return "to부정사";
  if (c.includes("명사절")) return "명사절";
  if (c.includes("가주어") || c.includes("진주어")) return "가주어/진주어";
  if (c.includes("가목적어") || c.includes("진목적어")) return "가목적어/진목적어";
  if (c.includes("동명사") && c.includes("주어")) return "동명사주어";
  if (c.includes("5형식") || c.includes("목적격보어")) return "5형식";
  if (c.includes("4형식")) return "4형식";
  if (c.includes("병렬")) return "병렬구조";
  if (c.includes("전치사") && c.includes("동명사")) return "전치사+동명사";
  if (c.includes("so") && c.includes("that") && (c.includes("~") || c.includes("구문") || c.includes("결과"))) return "so~that";
  if (c.includes("too") && c.includes("to") && (c.includes("~") || c.includes("구문"))) return "too~to";
  if (c.includes("as") && c.includes("as") && (c.includes("형") || c.includes("부") || c.includes("원급"))) return "as 형부 as";
  if (c.includes("비교") || c.includes("최상급")) return "비교구문";
  if (c.includes("수일치")) return "수일치";
  if (c.includes("생략")) return "생략";
  if (c.includes("강조") && (c.includes("구문") || c.includes("it is") || c.includes("it was"))) return "강조구문";
  if (c.includes("계속적") && (c.includes("용법") || c.includes("관계"))) {
    if (c.includes("부사")) return "계속적 용법 관계부사";
    return "계속적용법 관계대명사";
  }
  if (c.includes("대동사")) return "대동사";
  if (c.includes("분사") && !c.includes("분사구문") && !c.includes("후치")) return "분사";
  if (c.includes("전치사") && c.includes("관계")) return "전치사+관계대명사";
  if (c.includes("to be pp") || c.includes("to be p.p")) return "to be pp";
  return "기타";
}

function normalizeModelTagToUiTag(tag: string): string {
  const t = oneLine(tag).toLowerCase();
  if (!t) return "";
  if (t.includes("rel_subj") || t.includes("rel_obj_omit") || t.includes("관계대명사") || t.includes("주관대") || t.includes("목관대")) return "관계대명사";
  if (t.includes("rel_adv") || t.includes("관계부사")) return "관계부사";
  if (t.includes("agreement") || t.includes("수일치")) return "수일치";
  if (t.includes("noun_clause") || t.includes("명사절")) return "명사절";
  if (t.includes("it_dummy_subj") || t.includes("가주어") || t.includes("진주어")) return "가주어/진주어";
  if (t.includes("it_dummy_obj") || t.includes("가목적어") || t.includes("진목적어")) return "가목적어/진목적어";
  if (t.includes("five_pattern") || t.includes("5형식")) return "5형식";
  if (t.includes("to_inf") || t.includes("to부정사")) return "to부정사";
  if (t.includes("participle_post") || t.includes("후치수식")) return "분사 후치수식";
  if (t.includes("participle_clause") || t.includes("분사구문")) return "분사구문";
  if (t.includes("modal_passive") || t.includes("조동사+수동")) return "조동사+수동";
  if (t.includes("passive") || t.includes("수동태")) return "수동태";
  if (t.includes("parallel") || t.includes("병렬")) return "병렬구조";
  if (t.includes("prep_gerund") || (t.includes("전치사") && t.includes("동명사"))) return "전치사+동명사";
  if (t.includes("there_be")) return "기타";
  if (t.includes("comparison") || t.includes("비교")) return "비교구문";
  if (t.includes("omission") || t.includes("생략")) return "생략";
  if (t.includes("강조") && (t.includes("구문") || t.includes("it"))) return "강조구문";
  if (t.includes("현재완료") && t.includes("수동")) return "현재완료+수동";
  if (t.includes("계속적") && (t.includes("용법") || t.includes("관계"))) return "계속적용법 관계대명사";
  if (t.includes("대동사")) return "대동사";
  if (t.includes("분사") && !t.includes("분사구문") && !t.includes("후치")) return "분사";
  if (t.includes("전치사") && t.includes("관계")) return "전치사+관계대명사";
  return "";
}

function extractPinnedTemplateValues(raw: string, targetText?: string): string[] {
  const values: string[] = [];
  const push = (value?: string) => {
    const normalized = oneLine(String(value ?? "")).replace(/^[()]+|[()]+$/g, "").trim();
    if (!normalized) return;
    if (!values.includes(normalized)) values.push(normalized);
  };

  push(targetText);

  const patterns = [
    /관계(?:사|대명사|부사)\s+([A-Za-z][A-Za-z' -]*)/g,
    /형용사절\(([^)]+)\)/g,
    /명사절\(([^)]+)\)/g,
    /부사절\(([^)]+)\)/g,
    /선행사\s+([A-Za-z][A-Za-z' -]*)/g,
    /동사\s+([A-Za-z][A-Za-z' -]*)/g,
    /목적어\(?([A-Za-z][A-Za-z' -]*)\)?/g,
    /보어\(?([A-Za-z][A-Za-z' -]*)\)?/g,
    /\(([A-Za-z][A-Za-z' -]*~[A-Za-z][A-Za-z' -]*)\)/g,
  ];

  for (const re of patterns) {
    for (const match of raw.matchAll(re)) {
      push(match[1]);
    }
  }

  return values;
}

/**
 * Materialize a pinned pattern as a "style template":
 * - Keep the Korean structure/tone/endings from the template
 * - Replace English words/phrases with those from AI output (raw)
 * 
 * This prevents patterns like "what이 이끄는 명사절(What~important)"
 * from injecting "what" into sentences that use "that".
 */
function materializePinnedPattern(template: string, raw: string, targetText?: string): string {
  const normalizedTemplate = stripLeadingTagLabel(oneLine(template));
  const normalizedRaw = stripLeadingTagLabel(oneLine(raw));

  // If template has ___ placeholders, fill them with values extracted from AI output
  if (normalizedTemplate.includes("___")) {
    const values = extractPinnedTemplateValues(normalizedRaw, targetText);
    if (values.length === 0) return normalizedTemplate;
    let idx = 0;
    const filled = normalizedTemplate.replace(/___/g, () => values[idx++] ?? values[values.length - 1] ?? "___");
    return filled;
  }

  // No ___ placeholders: use template as STYLE guide, swap English parts from AI output
  // Extract English segments from both template and AI output
  const templateEnglish = extractEnglishSegments(normalizedTemplate);
  const rawEnglish = extractEnglishSegments(normalizedRaw);

  if (templateEnglish.length === 0 || rawEnglish.length === 0) {
    // No English to swap — return template as-is (pure Korean style pattern)
    return normalizedTemplate;
  }

  // Replace English segments in template with corresponding ones from AI output
  let result = normalizedTemplate;
  let rawIdx = 0;
  for (const tplSeg of templateEnglish) {
    if (rawIdx >= rawEnglish.length) break;
    // Replace the template's English segment with the AI's English segment
    result = result.replace(tplSeg, rawEnglish[rawIdx]);
    rawIdx++;
  }
  return result;
}

/**
 * Extract English word/phrase segments from a syntax note.
 * Captures things like: "what", "What~important", "that~them", "the project", 
 * parenthesized English like "(What~important)", standalone words like "who"
 */
function extractEnglishSegments(text: string): string[] {
  const segments: string[] = [];
  // Match parenthesized English: (What~important), (that~them)
  const parenMatches = text.match(/\([A-Za-z][A-Za-z'~\- ]*\)/g) || [];
  for (const m of parenMatches) segments.push(m);
  
  // Match English words/phrases outside parens: "what이", "that이", "who가" etc.
  // Pattern: English word(s) followed by Korean particle or at word boundary
  const wordMatches = text.match(/[A-Za-z][A-Za-z'~\-]*(?:\s+[A-Za-z][A-Za-z'~\-]*)*/g) || [];
  for (const m of wordMatches) {
    // Skip if already captured inside a paren segment
    if (!parenMatches.some(p => p.includes(m))) {
      if (m.length >= 2) segments.push(m);
    }
  }
  return segments;
}

function applyPinnedPattern(
  content: string,
  hintTags: TagId[],
  pinnedByTag: Map<string, string>,
  explicitUiTag?: string,
  targetText?: string,
): string {
  const raw = oneLine(content);
  if (!raw) return raw;
  if (!pinnedByTag || pinnedByTag.size === 0) return raw;

  const candidates: string[] = [];
  if (explicitUiTag) candidates.push(explicitUiTag);

  const leadingTag = detectLeadingTagLabel(content);
  if (leadingTag) candidates.push(leadingTag);

  for (const t of hintTags || []) {
    candidates.push(mapTagIdToUiTag(t));
  }

  const inferredUiTag = detectUiTagFromContent(raw);
  if (inferredUiTag) candidates.push(inferredUiTag);

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = normalizeTagKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pinned = oneLine(String(pinnedByTag.get(key) ?? ""));
    if (!pinned) continue;
    return materializePinnedPattern(pinned, raw, targetText);
  }

  // Fallback: partial match — if byTag key contains or is contained in candidate
  for (const candidate of candidates) {
    const key = normalizeTagKey(candidate);
    if (!key) continue;
    for (const [bKey, bVal] of pinnedByTag.entries()) {
      if (bKey.includes(key) || key.includes(bKey)) {
        return materializePinnedPattern(oneLine(bVal), raw, targetText);
      }
    }
  }

  return raw;
}

// -----------------------------
// Prompts
// -----------------------------
function buildFreestyleSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.

[역할]
사용자가 드래그로 선택한 구문에 대해, 해당 구문과 직접 관련된 문법/용법 포인트를 정확히 1개만 설명하라.

[절대 규칙]
- 출력은 반드시 JSON 함수 호출로만 한다.
- points는 반드시 1개만.
- 각 항목은 한 줄(줄바꿈 금지).
- 하나의 항목에 하나의 포인트만 / 부가설명은 슬래시(/)로 이어서 한 줄 유지.
- 정의/해석/배경설명 금지. 기능 중심으로만.
- 3단어 이상 영어 인용은 who~school처럼 축약.
- 큰따옴표(") 사용 금지.
- 불릿(•)을 절대 붙이지 말 것.
- 선택 구문 밖에 있는 문법 요소(다른 절, 다른 구문)는 절대 분석하지 말 것.

[분석 범위]
- 선택된 구문이 구조적 문법(관계사, 분사, 수동태 등)에 해당하면 해당 문법을 설명하라.
- 선택된 구문이 숙어/구동사/주요 표현(count as, serve as, result in 등)에 해당하면 그 용법을 설명하라.
- 어떤 경우든 선택 구문에 대한 포인트 1개만 작성하라.

[관계절(관계사절) 표기 규칙 — 반드시 지킬 것]
- 관계대명사/관계부사가 나오면, "관계사 ___부터 ___까지(예: who~object)가 선행사 ___를 수식함"을 반드시 포함할 것.

[문체 예시(이 톤 유지)]
- 주격 관계대명사 who/which/that이 선행사 ___를 수식하는 관계절을 이끔
- count as: ~로 간주되다 / 'A count as B' 구조로 A가 B에 해당함을 나타냄
- 조동사 + be p.p. 형태로 수동을 나타냄
- 분사(과거/현재)가 명사를 뒤에서 수식하는 후치수식 구조

[종결어미 규칙 — 최우선 준수]
- "~임", "~됨", "~함", "~있음" 등 음슴체 종결 절대 금지. 아래 변환을 반드시 따를 것:
  ✗ 역할임 → ✓ 역할 / ✗ 구조임 → ✓ 구조 / ✗ 수일치함 → ✓ 수일치
  ✗ 수동의 의미임 → ✓ 수동의 의미 / ✗ 목적격 보어 역할임 → ✓ 목적격 보어 역할
- 명사형(~역할, ~의미, ~구조) 또는 동사 원형(~이끔, ~나타냄)으로 끝낼 것.`;
}

function buildHintSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.

[중요]
사용자가 제공한 "허용 태그(TagId)"에 해당하는 문법 포인트만 작성하라.
허용 태그 밖의 포인트는 절대 추가하지 말 것.

[절대 규칙]
- 출력은 반드시 JSON 함수 호출로만 한다.
- points는 반드시 1개만.
- 각 항목은 한 줄(줄바꿈 금지).
- 하나의 항목에 하나의 포인트만 / 부가설명은 슬래시(/)로 이어서 한 줄 유지.
- 정의/해석/배경설명 금지. 기능 중심으로만.
- 3단어 이상 영어 인용은 who~school처럼 축약.
- 큰따옴표(") 사용 금지.
- 불릿(•)을 절대 붙이지 말 것. (UI가 번호를 붙인다)

[관계절(관계사절) 표기 규칙 — 반드시 지킬 것]
- 관계대명사/관계부사가 나오면, “관계사 ___부터 ___까지(예: who~object)가 선행사 ___를 수식함”을 반드시 포함할 것.
- 범위는 항상 ‘관계사 첫단어~관계절 마지막단어’로 표시할 것. (예: who~object, that~movement, where~live)

[문체 예시(이 톤 유지)]
- 주격 관계대명사 who/which/that이 선행사 ___를 수식하는 관계절을 이끔.
- 목적격 관계대명사 (which/that) 생략 가능 구조.
- 선행사 ___ 단복수에 따라 관계절 동사 ___가 수일치.
- 분사(과거/현재)가 명사를 뒤에서 수식하는 후치수식 구조.
- 조동사 + be p.p. 형태로 수동을 나타냄.

[종결어미 규칙 — 최우선 준수]
- "~임", "~됨", "~함", "~있음" 등 음슴체 종결 절대 금지. 아래 변환을 반드시 따를 것:
  ✗ 역할임 → ✓ 역할 / ✗ 구조임 → ✓ 구조 / ✗ 수일치함 → ✓ 수일치
  ✗ 수동의 의미임 → ✓ 수동의 의미 / ✗ 목적격 보어 역할임 → ✓ 목적격 보어 역할
- 명사형(~역할, ~의미, ~구조) 또는 동사 원형(~이끔, ~나타냄)으로 끝낼 것.`;
}

function buildAutoSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.

[역할]
주어진 문장에서 수능에 출제될 수 있는 핵심 문법 포인트를 자동으로 찾아 설명하라.

[절대 규칙]
- 출력은 반드시 JSON 함수 호출로만 한다.
- points는 1~5개(최대 5). 문장에서 왼쪽부터 등장하는 순서대로 정렬하라.
- 각 항목은 한 줄(줄바꿈 금지).
- 하나의 항목에 하나의 포인트만 / 부가설명은 슬래시(/)로 이어서 한 줄 유지.
- 정의/해석/배경설명 금지. 기능 중심으로만.
- 3단어 이상 영어 인용은 who~school처럼 물결(~) 축약.
- 큰따옴표(") 사용 금지.
- 불릿(•)을 절대 붙이지 말 것. (UI가 번호를 붙인다)

[관계절(관계사절) 표기 규칙 — 반드시 지킬 것]
- 관계대명사/관계부사가 나오면, "관계사 ___부터 ___까지(예: who~object)가 선행사 ___를 수식함"을 반드시 포함할 것.
- 범위는 항상 '관계사 첫단어~관계절 마지막단어'로 표시할 것. (예: who~object, that~movement, where~live)

[우선 추출 대상]
관계대명사(주격/목적격/생략), 관계부사, 명사절(that/wh-), 가주어/진주어, 가목적어/진목적어,
5형식(O.C), to부정사 용법, 분사 후치수식, 분사구문, 수동태, 조동사+수동(can/may/must/will + be p.p.), 병렬구조,
전치사+동명사, There is/are, 비교구문, 생략, 수일치,
숙어/구동사(count as, serve as, result in, lead to, contribute to 등), 주요 표현 용법

[조동사+수동태 필수 추출 규칙]
- 문장에 can/could/may/might/must/should/will/would + be p.p. 형태가 있으면 반드시 포인트로 포함할 것.

[빈 결과 방지 규칙]
- 구조적 문법 포인트(관계사, 분사, 수동태 등)가 없는 경우에도 빈 배열을 반환하지 말 것.
- 이 경우 해당 문장의 핵심 숙어/구동사/주요 표현의 용법을 설명하라.

[문체 예시(이 톤 유지)]
- 주격 관계대명사 that이 선행사 pressures를 수식하는 관계절을 이끔
- cause + O + to V(5형식) 구조 / it이 the museum을 가리킴
- what이 이끄는 명사절이 emphasise의 목적어 역할
- 분사(과거/현재)가 명사를 뒤에서 수식하는 후치수식 구조
- can/may/must + be p.p. 형태의 조동사 수동태 구조
- count as: ~로 간주되다 / 'A count as B' 구조로 A가 B에 해당함을 나타냄

[종결어미 규칙 — 최우선 준수]
- "~임", "~됨", "~함", "~있음" 등 음슴체 종결 절대 금지. 아래 변환을 반드시 따를 것:
  ✗ 역할임 → ✓ 역할 / ✗ 구조임 → ✓ 구조 / ✗ 수일치함 → ✓ 수일치
  ✗ 수동의 의미임 → ✓ 수동의 의미 / ✗ 목적격 보어 역할임 → ✓ 목적격 보어 역할
- 명사형(~역할, ~의미, ~구조) 또는 동사 원형(~이끔, ~나타냄)으로 끝낼 것.

[targetText 규칙 — 반드시 지킬 것]
- 각 포인트마다, 원문에서 해당 문법 요소 자체가 위치한 핵심 구문(2~5단어)을 targetText로 반환하라.
- 각 포인트마다, 해당 문법 태그를 tag 필드에 반드시 함께 반환하라. (예: 관계대명사, 분사구문, 수동태, 5형식, 수일치 또는 REL_SUBJ 같은 TagId)
- targetText는 반드시 원문에 존재하는 연속된 단어여야 한다.
- targetText는 해당 문법 요소 자체가 시작되는 곳을 가리켜야 한다. 수식 대상(피수식어)이 아님.
  ✅ to부정사 형용사적 용법 → targetText: "to maintain" (to부정사 자체)
  ❌ targetText: "a hard balance" (수식 대상은 안 됨)
  ✅ restrict A to B 구조 → targetText: "to restrict the"
  ✅ 지시대명사 that → targetText: "that is a"
  ✅ 수동태 be p.p. → targetText: "was discovered by"
  ✅ 관계대명사 who가 이끄는 절 → targetText: "who attended the"
- targetText는 반드시 원문의 정확한 표면형(surface form)을 사용해야 한다. 절대로 단어를 축약하거나 원형/기본형으로 바꾸지 말 것.
  ❌ its → it (축약 금지)
  ❌ holds → hold (원형 변환 금지)
  ❌ discovered → discover (원형 변환 금지)
  ✅ 원문에 "its"가 있으면 targetText에도 반드시 "its"를 포함
  ✅ 원문에 "holds"가 있으면 targetText에도 반드시 "holds"를 포함
- 짧은 단어(it, its, that, this, those, a, the 등)만으로 targetText를 구성하지 말 것. 반드시 2단어 이상, 주변 단어를 포함하여 문맥상 유일하게 식별 가능하도록 하라.
  ❌ targetText: "it" (너무 짧아 오매칭 위험)
  ❌ targetText: "its" (너무 짧아 오매칭 위험)
  ✅ targetText: "it is important" (주변 포함)
  ✅ targetText: "holds its breath" (주변 포함)

[동일 대상 병합 규칙]
- 같은 단어/구문에 대해 여러 포인트가 있으면(예: to부정사의 명사적 용법 + restrict A to B가 동일한 "to restrict"에 해당), 동일한 targetText를 공유하고 points 배열에서 연속 배치하라.
- 프론트엔드가 같은 targetText를 가진 연속 포인트를 하나의 번호로 묶어 표시한다.`;
}

const tools = [
  {
    type: "function",
    function: {
      name: "syntax_result",
      description: "Return concise CSAT-style syntax points",
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["points"],
        additionalProperties: false,
      },
    },
  },
];

const autoTools = [
  {
    type: "function",
    function: {
      name: "syntax_result",
      description: "Return concise CSAT-style syntax points with target phrases",
      parameters: {
        type: "object",
        properties: {
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "구문분석 설명" },
                targetText: { type: "string", description: "원문에서 해당 포인트가 적용되는 핵심 구문(2~5단어)" },
                tag: { type: "string", description: "문법 태그(예: 관계대명사, 분사구문, 수동태, 5형식, 수일치, REL_SUBJ 등)" },
              },
              required: ["text", "targetText", "tag"],
            },
          },
        },
        required: ["points"],
        additionalProperties: false,
      },
    },
  },
];

// -----------------------------
// Shared: fetch pinned patterns
// -----------------------------
/**
 * Extract a leading phrase before a colon in pinned_content.
 * e.g. "rather than: ~라기보다는" → "rather than"
 * e.g. "as ~ as possible 구조로" → null (no colon pattern)
 */
function extractLeadingPhrase(content: string): string | null {
  const match = content.match(/^([A-Za-z][A-Za-z\s~]+?)(?:\s*:)/);
  if (match) {
    const phrase = match[1].trim().toLowerCase().replace(/\s+/g, " ");
    if (phrase.length >= 3) return phrase;
  }
  return null;
}

/**
 * Check if a pattern is a reusable template (has ___ placeholders)
 * vs a sentence-specific example (references specific words from one sentence).
 */
function isReusableTemplate(content: string): boolean {
  return content.includes("___");
}

/**
 * Strict relevance scoring for a pattern against a sentence.
 * Returns a score 0-1. Higher = more relevant.
 */
function patternRelevanceScore(patternContent: string, sentenceLower: string): number {
  if (!sentenceLower) return 0;

  // 1) Check for leading phrase match (e.g., "rather than:", "as ~ as")
  const phrase = extractLeadingPhrase(patternContent);
  if (phrase) {
    // For phrase patterns, the phrase itself must appear in the sentence
    const normalizedPhrase = phrase.replace(/\s*~\s*/g, " ").trim();
    if (sentenceLower.includes(normalizedPhrase)) return 1.0;
    // Also handle tilde-separated patterns like "as ~ as" → check both parts
    if (phrase.includes("~")) {
      const parts = phrase.split("~").map(p => p.trim()).filter(p => p.length >= 2);
      const allPresent = parts.every(p => sentenceLower.includes(p));
      if (allPresent) return 0.9;
    }
    return 0; // Phrase pattern but phrase not in sentence → not relevant
  }

  // 2) For template patterns (with ___), use keyword ratio matching
  const keywords = extractEnglishKeywords(patternContent);
  if (keywords.length === 0) return 0;

  // Deduplicate keywords
  const uniqueKeywords = Array.from(new Set(keywords));
  const matchCount = uniqueKeywords.filter(kw => sentenceLower.includes(kw)).length;
  const ratio = matchCount / uniqueKeywords.length;

  // For reusable templates, require lower threshold since blanks won't match
  if (isReusableTemplate(patternContent)) {
    return ratio >= 0.3 ? ratio : 0;
  }

  // For sentence-specific examples, require high match ratio
  // because most keywords should be present if it's truly relevant
  return ratio >= 0.6 ? ratio : 0;
}

async function fetchPinnedPatterns(
  _userId: string | undefined,
  authHeader?: string | null,
  sentence?: string,
): Promise<PinnedPatternsData> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || (!serviceRoleKey && !anonKey)) return { promptBlock: "", byTag: new Map() };
    const apiKey = serviceRoleKey || anonKey!;
    const auth = serviceRoleKey ? `Bearer ${serviceRoleKey}` : (authHeader || "");
    if (!auth) return { promptBlock: "", byTag: new Map() };
    const url = `${supabaseUrl}/rest/v1/syntax_patterns?is_global=eq.true&order=created_at.desc&select=tag,pinned_content`;
    const res = await fetch(url, { headers: { apikey: apiKey, Authorization: auth } });
    if (!res.ok) return { promptBlock: "", byTag: new Map() };
    const allPatterns = await res.json();
    if (allPatterns.length === 0) return { promptBlock: "", byTag: new Map() };
    const byTag = new Map<string, string>();

    // 2-track pattern matching:
    // Track 1: Grammar-tag patterns → always include by tag (no keyword matching needed)
    // Track 2: Phrase/expression patterns (기타, 숙어/표현) → require keyword relevance
    const GRAMMAR_TAGS = new Set([
      "관계대명사", "관계부사", "분사구문", "분사 후치수식", "분사", "수동태", "조동사+수동",
      "to부정사", "명사절", "가주어/진주어", "가목적어/진목적어", "5형식", "4형식", "병렬구조",
      "전치사+동명사", "비교구문", "수일치", "생략", "강조구문", "현재완료+수동",
      "계속적용법 관계대명사", "계속적 용법 관계부사", "대동사", "전치사+관계대명사", "지칭",
      "동격접", "동명사주어", "as 형부 as", "so~that", "to be pp", "too~to",
    ]);

    let relevantPatterns: any[] = [];
    const sentenceLower = oneLine(sentence || "").toLowerCase();

    for (const p of allPatterns) {
      const tag = String(p?.tag ?? "").trim();
      const content = String(p?.pinned_content ?? "").trim();
      if (!tag || !content) continue;

      const isGrammarTag = GRAMMAR_TAGS.has(tag);

      if (isGrammarTag) {
        // Track 1: Grammar tag → always include (no keyword check)
        relevantPatterns.push(p);
      } else if (sentenceLower) {
        // Track 2: Expression/phrase tag → require keyword relevance
        const score = patternRelevanceScore(content, sentenceLower);
        if (score > 0) relevantPatterns.push(p);
      }
    }

    // Log for debugging
    if (relevantPatterns.length > 0) {
      console.log(`[pinned-patterns] Sentence: "${sentenceLower.slice(0, 60)}..."`);
      console.log(`[pinned-patterns] Matched ${relevantPatterns.length}/${allPatterns.length} patterns (grammar-tag + phrase)`);
    } else {
      console.log(`[pinned-patterns] No patterns matched for: "${sentenceLower.slice(0, 60)}..."`);
    }

    if (relevantPatterns.length === 0) return { promptBlock: "", byTag };

    // Build byTag map from all relevance-scored patterns (no double filter)
    for (const p of relevantPatterns) {
      const tag = String(p?.tag ?? "").trim();
      const content = String(p?.pinned_content ?? "").trim();
      if (!tag || !content) continue;
      const key = normalizeTagKey(tag);
      if (!byTag.has(key)) byTag.set(key, content);
    }

    // Inject all relevance-scored patterns (no template-only filter)
    if (relevantPatterns.length === 0) return { promptBlock: "", byTag };

    const tagLines = relevantPatterns
      .map((p: any) => {
        const tag = String(p?.tag ?? "").trim();
        const content = String(p?.pinned_content ?? "").trim();
        return tag && content ? `- ${tag}: ${content}` : "";
      })
      .filter(Boolean)
      .join("\n");
    const promptBlock =
      `\n\n[필수 적용 규칙 — 고정 패턴]\n` +
      `아래 패턴은 사용자가 직접 지정한 필수 설명 형식이다.\n` +
      `해당 문법 요소가 문장에 존재하면, 반드시 아래 패턴의 설명 구조·말투·종결 방식을 그대로 따라야 한다.\n` +
      `단, 패턴에 포함된 영어 단어(예: what, important, built 등)는 절대 그대로 쓰지 말 것.\n` +
      `영어 단어와 구문 범위는 반드시 현재 문장의 실제 내용으로 교체하라.\n` +
      `현재 문장에 없는 영어 단어가 출력에 포함되면 오류다.\n` +
      `___가 있으면 해당 문장의 실제 단어로 교체하라.\n` +
      `문장에 해당 문법 요소가 없으면 이 패턴을 완전히 무시하라. 억지로 적용하지 말 것.\n` +
      `${tagLines}\n` +
      `출력에 태그명 접두어(예: 관계대명사:, 5형식:)를 붙이지 말 것.`;
    return { promptBlock, byTag };
  } catch (e) {
    console.error("[pinned-patterns] Error fetching patterns:", e);
    return { promptBlock: "", byTag: new Map() };
  }
}

// -----------------------------
// Shared: fetch learning examples
// -----------------------------
async function fetchLearningBlock(userId: string | undefined, authHeader?: string | null): Promise<string> {
  // Raw learning examples can leak unrelated words and structures from older
  // sentences into the current sentence. Keep syntax generation sentence-local.
  return "";
}

// -----------------------------
// Server
// -----------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqAuth = req.headers.get("authorization");
    const { sentence, selectedText, userHint, hintTags, mode, userId } = await req.json();

    const full = oneLine(sentence || "");
    const selected = oneLine(selectedText || "")
      .replace(/\s*\/\s*/g, " ")
      .trim();
    const rawHint = oneLine(userHint || "");
    const isAutoMode = mode === "auto";

    if (!full && !selected) {
      return new Response(JSON.stringify({ error: "Missing sentence or selectedText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let textToAnalyze = selected || full;

    // ── 자동 생성 모드: 태그 필터 없이 자유 추출 ──
    if (isAutoMode) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const [learningBlock, pinnedData] = await Promise.all([
        fetchLearningBlock(userId, reqAuth),
        fetchPinnedPatterns(userId, reqAuth, textToAnalyze || full),
      ]);
      const userMessage = `문장: ${full}\n` +
        `이 문장에서 수능에 출제될 수 있는 핵심 문법 포인트를 찾아서 points로 작성하라.\n` +
        `각 포인트마다 원문에서 해당 문법이 적용되는 핵심 구문(2~5단어)을 targetText로 함께 반환하라.\n` +
        `고정 패턴과 태그가 매칭되면 해당 패턴을 최우선으로 따르라.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          max_tokens: 1500,
          messages: [
            { role: "system", content: buildAutoSystemPrompt() + pinnedData.promptBlock + learningBlock },
            { role: "user", content: userMessage },
          ],
          tools: autoTools,
          tool_choice: { type: "function", function: { name: "syntax_result" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      console.log("AI response (auto):", JSON.stringify(data.choices?.[0]?.message).slice(0, 800));
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      type AutoPoint = { text: string; targetText: string; tag?: string };
      let autoPoints: AutoPoint[] = [];

      if (toolCall?.function?.arguments) {
        const parsed = safeJsonParse(toolCall.function.arguments);
        const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];
        // Handle both object[] and string[] formats
        autoPoints = rawPoints.map((p: any) =>
          typeof p === "string"
            ? { text: p, targetText: "", tag: "" }
            : { text: String(p?.text ?? ""), targetText: String(p?.targetText ?? ""), tag: String(p?.tag ?? "") }
        );
      } else {
        const content = data.choices?.[0]?.message?.content ?? "";
        console.log("No tool_call (auto), trying content fallback:", content.slice(0, 300));
        try {
          const parsed = safeJsonParse(content);
          const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];
          autoPoints = rawPoints.map((p: any) =>
            typeof p === "string"
              ? { text: p, targetText: "", tag: "" }
              : { text: String(p?.text ?? ""), targetText: String(p?.targetText ?? ""), tag: String(p?.tag ?? "") }
          );
        } catch {
          const fallback = oneLine(content);
          autoPoints = fallback ? [{ text: fallback, targetText: "", tag: "" }] : [];
        }
      }

      // Strip JSON artifacts that leak when response is truncated
      const stripJsonArtifacts = (s: string) =>
        s.replace(/[{}\[\]]/g, "")
         .replace(/"?(text|targetText|tag|finish_reason)"?\s*:/gi, "")
         .replace(/,\s*"?tag"?\s*:\s*$/gi, "")
         .replace(/\s*"?tag"?\s*:\s*$/gi, "")
         .replace(/,\s*"?finish_reason"?\s*:\s*$/gi, "")
         .replace(/\s*"?finish_reason"?\s*:\s*$/gi, "")
         .replace(/\s*[A-Za-z0-9_]*assistant[A-Za-z0-9_]*syntax[A-Za-z0-9_]*points?:tag:\s*$/gi, "")
         .replace(/\s*[A-Za-z0-9_]*syntax[A-Za-z0-9_]*result[A-Za-z0-9_]*points?:tag:\s*$/gi, "")
         .replace(/\s*[A-Za-z0-9_]+(?:_[A-Za-z0-9_]+){2,}:tag:\s*$/g, "")
         .replace(/,\s*$/g, "")
         .trim();

      autoPoints = autoPoints
        .map((p) => ({
          text: finalizeSyntaxText(stripJsonArtifacts(p.text)),
          targetText: oneLine(p.targetText),
          tag: oneLine(String(p.tag ?? "")),
        }))
        .filter((p) => p.text);
      autoPoints = autoPoints.slice(0, 5).map((p) => ({
        text: p.text,
        targetText: p.targetText,
        tag: p.tag,
      }));

      // Post-processing: force pinned pattern replacement on auto-generated points
      if (pinnedData.byTag && pinnedData.byTag.size > 0) {
        autoPoints = autoPoints.map((p) => ({
          ...p,
          text: applyPinnedPattern(
            p.text,
            [],
            pinnedData.byTag,
            p.tag || undefined,
            p.targetText || sentence,
          ),
        }));
      }

      if (autoPoints.length === 0) {
        autoPoints = [{ text: "(이 문장에서 주요 문법 포인트를 찾지 못했습니다)", targetText: "", tag: "" }];
      }

      const syntaxNotes = autoPoints.map((p) => p.text).join("\n");
      const res: GrammarResponse & { autoPoints?: AutoPoint[] } = {
        syntaxNotes,
        detectedTags: [],
        normalizedHint: "",
        autoPoints,
      };
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 힌트 모드: 태그 기반 + 폴백 ──
    let tags: TagId[] = [];
    if (Array.isArray(hintTags) && hintTags.length > 0) {
      tags = hintTags as TagId[];
    } else {
      tags = detectTagsFromHint(rawHint);
    }

    // 태그 매칭 실패 시 → 힌트+선택 텍스트를 그대로 프롬프트에 넘겨 자유 분석
    const useFreestyle = tags.length === 0;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch learning examples + pinned patterns for hint mode too
    const [learningBlock, pinnedData] = await Promise.all([
      fetchLearningBlock(userId, reqAuth),
      fetchPinnedPatterns(userId, reqAuth, textToAnalyze || full),
    ]);

    const userMessage = useFreestyle
      ? `전체 문장: ${full}\n` +
        `선택 구문: ${selected || "(없음/전체문장기준)"}\n` +
        `분석 대상: ${textToAnalyze}\n` +
        `사용자 힌트: ${rawHint || "(없음)"}\n` +
        `위 선택 구문에 해당하는 문법/용법 포인트를 정확히 1개만 작성하라. 선택 구문 외의 다른 문법 요소는 분석하지 말 것.`
      : `전체 문장: ${full}\n` +
        `선택 구문: ${selected || "(없음/전체문장기준)"}\n` +
        `분석 대상: ${textToAnalyze}\n` +
        `허용 태그(TagId): ${tags.join(", ")}\n` +
        `태그 의미:\n${tagsToPromptBlock(tags)}\n` +
        `주의: 위 태그에 해당하는 포인트만 points로 작성하라.`;

    const systemPrompt = useFreestyle ? buildFreestyleSystemPrompt() : buildHintSystemPrompt();

    const hintModel = "google/gemini-3-flash-preview";
    const useToolCall = hintModel.includes("flash");

    const reqBody: any = {
      model: hintModel,
      temperature: useFreestyle ? 0.2 : 0.12,
      max_tokens: useToolCall ? 450 : 2000,
      messages: [
        {
          role: "system",
          content:
            systemPrompt + pinnedData.promptBlock + learningBlock +
            (useToolCall ? "" : '\n\n출력 형식: 반드시 {"points":[...]} JSON만 출력하라. 다른 텍스트 없이 JSON만.'),
        },
        { role: "user", content: userMessage },
      ],
    };
    if (useToolCall) {
      reqBody.tools = tools;
      reqBody.tool_choice = { type: "function", function: { name: "syntax_result" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response (hint):", JSON.stringify(data.choices?.[0]?.message).slice(0, 500));
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let points: string[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = safeJsonParse(toolCall.function.arguments);
      points = Array.isArray(parsed?.points) ? parsed.points : [];
    } else {
      const content = data.choices?.[0]?.message?.content ?? "";
      console.log("No tool_call, trying content fallback:", content.slice(0, 300));
      try {
        const parsed = safeJsonParse(content);
        points = Array.isArray(parsed?.points) ? parsed.points : [];
      } catch {
        const fallback = oneLine(content);
        points = fallback ? [fallback] : [];
      }
    }

    points = points
      .map(finalizeSyntaxText)
      .filter(Boolean)
      .map((p) => useFreestyle ? finalizeSyntaxText(p) : finalizeSyntaxText(applyPinnedPattern(p, tags, pinnedData.byTag)));

    if (points.length === 0) {
      points = useFreestyle
        ? ["(해당 문장에서 문법 포인트를 찾지 못했습니다)"]
        : ["(힌트 태그에 해당하는 포인트를 문장에서 찾기 어려움) / 드래그 범위를 조금 넓히거나 힌트를 구체화"];
    }

    const maxPts = 1;
    points = points.slice(0, maxPts);

    const syntaxNotes = formatAsLines(points, maxPts);

    const res: GrammarResponse = {
      syntaxNotes,
      detectedTags: tags,
      normalizedHint: rawHint,
    };

    return new Response(JSON.stringify(res), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grammar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
