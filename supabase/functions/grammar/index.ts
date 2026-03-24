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

function oneLine(s: string) {
  return String(s ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string) {
  return oneLine(text).split(" ").filter(Boolean).length;
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

function formatAsLines(points: string[], maxLines: number) {
  const cleaned = points
    .map((p) => oneLine(p))
    .filter(Boolean)
    .map(stripLeadingBullets);

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
  if (c.includes("관계사")) {
    if (c.includes("where") || c.includes("when") || c.includes("why") || c.includes("how")) return "관계부사";
    return "관계대명사";
  }
  if (c.includes("관계대명사") || c.includes("주관대") || c.includes("목관대")) return "관계대명사";
  if (c.includes("관계부사")) return "관계부사";
  if (c.includes("분사구문")) return "분사구문";
  if (c.includes("후치수식") || c.includes("후치")) return "분사 후치수식";
  if (c.includes("조동사") && c.includes("수동")) return "조동사+수동";
  if (c.includes("수동태") || c.includes("be p.p")) return "수동태";
  if (c.includes("to부정사") || c.includes("to-v")) return "to부정사";
  if (c.includes("명사절")) return "명사절";
  if (c.includes("가주어") || c.includes("진주어")) return "가주어/진주어";
  if (c.includes("가목적어") || c.includes("진목적어")) return "가목적어/진목적어";
  if (c.includes("5형식") || c.includes("목적격보어")) return "5형식";
  if (c.includes("병렬")) return "병렬구조";
  if (c.includes("전치사") && c.includes("동명사")) return "전치사+동명사";
  if (c.includes("비교") || c.includes("최상급")) return "비교구문";
  if (c.includes("수일치")) return "수일치";
  if (c.includes("생략")) return "생략";
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
  return "";
}

function applyPinnedPattern(
  content: string,
  hintTags: TagId[],
  pinnedByTag: Map<string, string>,
  explicitUiTag?: string,
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

  candidates.push(detectUiTagFromContent(raw));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = normalizeTagKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pinned = oneLine(String(pinnedByTag.get(key) ?? ""));
    if (!pinned) continue;

    const normalizedPinned = stripLeadingTagLabel(pinned);
    // Keep model output if the pattern is still a template.
    if (normalizedPinned.includes("___")) return raw;
    return normalizedPinned;
  }

  return raw;
}

function extractEnglishTokens(text: string): string[] {
  return oneLine(text)
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

type SurfaceWord = {
  raw: string;
  normalized: string;
  index: number;
};

function normalizeSurfaceToken(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/^[^a-z0-9']+/g, "")
    .replace(/[^a-z0-9']+$/g, "")
    .trim();
}

function tokenizeSurfaceWords(text: string): SurfaceWord[] {
  return String(text ?? "")
    .trim()
    .split(/\s+/)
    .map((raw, index) => ({
      raw,
      normalized: normalizeSurfaceToken(raw),
      index,
    }))
    .filter((word) => word.normalized);
}

function findTargetWordRanges(sentence: string, targetText: string): Array<{ wordStart: number; wordEnd: number }> {
  const sentenceWords = tokenizeSurfaceWords(sentence);
  const targetWords = tokenizeSurfaceWords(targetText).map((word) => word.normalized);
  if (targetWords.length === 0 || sentenceWords.length === 0) return [];

  const ranges: Array<{ wordStart: number; wordEnd: number }> = [];
  for (let i = 0; i <= sentenceWords.length - targetWords.length; i += 1) {
    let matches = true;
    for (let j = 0; j < targetWords.length; j += 1) {
      if (sentenceWords[i + j].normalized !== targetWords[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      ranges.push({ wordStart: sentenceWords[i].index, wordEnd: sentenceWords[i + targetWords.length - 1].index });
    }
  }
  return ranges;
}

function selectionContextTokens(text: string, edge: "before" | "after"): string[] {
  const words = tokenizeSurfaceWords(text).map((word) => word.normalized);
  if (words.length === 0) return [];
  return edge === "before" ? words.slice(-3) : words.slice(0, 3);
}

function countTokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  return a.reduce((count, token) => count + (setB.has(token) ? 1 : 0), 0);
}

function isTargetTextInSentence(targetText: string, sentence: string): boolean {
  return findTargetWordRanges(sentence, targetText).length > 0;
}

function isSelectionRelevantTarget(
  sentence: string,
  selectedText: string,
  targetText: string,
  selectedWordStart?: number,
  selectedWordEnd?: number,
  selectedContextBefore?: string,
  selectedContextAfter?: string,
): boolean {
  const selected = oneLine(selectedText).toLowerCase();
  const target = oneLine(targetText).toLowerCase();
  if (!selected || !target) return false;

  const selectedTokens = tokenizeSurfaceWords(selectedText);
  const strictExactOccurrence = selectedTokens.length <= 1;
  const hasExactSelection = Number.isInteger(selectedWordStart) && Number.isInteger(selectedWordEnd);
  if (hasExactSelection) {
    const ranges = findTargetWordRanges(sentence, targetText);
    if (ranges.length === 0) return false;

    const directHit = ranges.some(
      (range) =>
        range.wordStart <= (selectedWordEnd as number) &&
        range.wordEnd >= (selectedWordStart as number),
    );
    if (directHit) return true;
    if (strictExactOccurrence) return false;

    const beforeTokens = selectionContextTokens(selectedContextBefore ?? "", "before");
    const afterTokens = selectionContextTokens(selectedContextAfter ?? "", "after");
    const sentenceWords = tokenizeSurfaceWords(sentence);
    for (const range of ranges) {
      const leftContext = sentenceWords
        .slice(Math.max(0, range.wordStart - beforeTokens.length), range.wordStart)
        .map((word) => word.normalized);
      const rightContext = sentenceWords
        .slice(range.wordEnd + 1, range.wordEnd + 1 + afterTokens.length)
        .map((word) => word.normalized);
      const score = countTokenOverlap(beforeTokens, leftContext) + countTokenOverlap(afterTokens, rightContext);
      if (score > 0) return true;
    }
    return false;
  }

  if (selected.includes(target) || target.includes(selected)) return true;

  if (strictExactOccurrence) return false;

  const selectedTokenSet = new Set(extractEnglishTokens(selected));
  const targetTokens = extractEnglishTokens(target);
  return targetTokens.some((token) => selectedTokenSet.has(token));
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
- 단, 사용자가 드래그하여 자동생성한 경우에는 예외다. 사용자가 짧은 기능어(that, it, to, we 등) 1개만 선택했다면 targetText는 반드시 그 정확한 선택 토큰 자체 또는 그 토큰을 직접 포함한 최소 구간이어야 한다.
- 드래그 자동생성에서는 같은 철자의 다른 occurrence로 바꾸지 말 것.

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
async function fetchPinnedPatterns(_userId: string | undefined, authHeader?: string | null): Promise<PinnedPatternsData> {
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
    const patterns = await res.json();
    if (patterns.length === 0) return { promptBlock: "", byTag: new Map() };

    const byTag = new Map<string, string>();
    for (const p of patterns) {
      const tag = String(p?.tag ?? "").trim();
      const content = String(p?.pinned_content ?? "").trim();
      if (!tag || !content) continue;
      const key = normalizeTagKey(tag);
      if (!byTag.has(key)) byTag.set(key, content);
    }

    const tagLines = patterns
      .map((p: any) => {
        const tag = String(p?.tag ?? "").trim();
        const content = String(p?.pinned_content ?? "").trim();
        return tag && content ? `- ${tag}: ${content}` : "";
      })
      .filter(Boolean)
      .join("\n");
    const promptBlock =
      `\n\n[고정 패턴 — 최우선 규칙]\n` +
      `아래 태그에 해당하는 포인트는 반드시 해당 패턴의 문장을 그대로 사용하라.\n` +
      `___만 실제 단어로 교체하고, 그 외 단어·구조·어순은 절대 바꾸거나 추가하지 말 것.\n` +
      `패턴에 없는 부가 설명, 슬래시(/) 뒤 추가 분석, 범위 표시 등을 덧붙이지 말 것.\n` +
      `${tagLines}\n` +
      `출력에 태그명 접두어(예: 관계대명사:, 5형식:)를 붙이지 말 것.`;
    return { promptBlock, byTag };
  } catch {
    return { promptBlock: "", byTag: new Map() };
  }
}

// -----------------------------
// Shared: fetch learning examples
// -----------------------------
async function fetchLearningBlock(userId: string | undefined, authHeader?: string | null): Promise<string> {
  if (!userId) return "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || (!serviceRoleKey && !anonKey)) return "";
    const apiKey = serviceRoleKey || anonKey!;
    const auth = serviceRoleKey ? `Bearer ${serviceRoleKey}` : (authHeader || "");
    if (!auth) return "";
    const url = `${supabaseUrl}/rest/v1/learning_examples?user_id=eq.${userId}&type=eq.syntax&order=created_at.desc&limit=5&select=sentence,ai_draft,final_version`;
    const res = await fetch(url, { headers: { apikey: apiKey, Authorization: auth } });
    if (!res.ok) return "";
    const examples = await res.json();
    if (examples.length === 0) return "";
    const lines = examples.map((e: any) => `원문: ${e.sentence}\nAI초안: ${e.ai_draft}\n최종: ${e.final_version}`).join("\n---\n");
    return `\n\n[사용자 선호 스타일 예시 — 아래 최종 버전의 톤·길이·표현 방식을 참고하여 작성하라]\n${lines}`;
  } catch {
    return "";
  }
}

// -----------------------------
// Server
// -----------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const reqAuth = req.headers.get("authorization");
    const reqBody = await req.json();
    const { sentence, selectedText, userHint, hintTags, mode, userId } = reqBody;
    const selectedWordStart = Number.isInteger(reqBody?.selectedWordStart) ? Number(reqBody.selectedWordStart) : undefined;
    const selectedWordEnd = Number.isInteger(reqBody?.selectedWordEnd) ? Number(reqBody.selectedWordEnd) : undefined;
    const selectedContextBefore = oneLine(reqBody?.selectedContextBefore || "");
    const selectedContextAfter = oneLine(reqBody?.selectedContextAfter || "");

    const full = oneLine(sentence || "");
    const selected = oneLine(selectedText || "")
      .replace(/\s*\/\s*/g, " ")
      .trim();
    const rawHint = oneLine(userHint || "");
    const isAutoMode = mode === "auto";
    const isSelectionAuto = isAutoMode && Boolean(selected);

    if (!full && !selected) {
      return new Response(JSON.stringify({ error: "Missing sentence or selectedText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let textToAnalyze = selected || full;
    if (selected && countWords(selected) < 3 && full) textToAnalyze = full;

    // ── 자동 생성 모드: 태그 필터 없이 자유 추출 ──
    if (isAutoMode) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const [learningBlock, pinnedData] = await Promise.all([
        fetchLearningBlock(userId, reqAuth),
        fetchPinnedPatterns(userId, reqAuth),
      ]);
      const userMessage = isSelectionAuto
        ? `문장: ${full}\n` +
          `선택 구문: ${selected}\n` +
          `선택 위치(word index): ${selectedWordStart ?? "?"}~${selectedWordEnd ?? "?"}\n` +
          `선택 앞 문맥: ${selectedContextBefore || "(없음)"}\n` +
          `선택 뒤 문맥: ${selectedContextAfter || "(없음)"}\n` +
          `선택 구문과 직접 관련된 핵심 문법 포인트를 정확히 1개만 찾아서 points로 작성하라.\n` +
          `반드시 선택 구문 자체 또는 선택 구문이 포함된 핵심 문법 요소만 설명하라.\n` +
          `선택 구문이 문장에 여러 번 나올 수 있으면, 반드시 위 위치와 앞뒤 문맥에 해당하는 선택된 occurrence만 분석하라.\n` +
          `다른 절, 다른 문법 요소, 다른 문장 설명은 절대 추가하지 말라.\n` +
          `targetText는 반드시 선택된 occurrence 자체를 포함하거나, 최소한 그 occurrence와 직접 겹치는 원문 구간으로 반환하라.\n` +
          `고정 패턴과 태그가 매칭되면 해당 패턴의 형식/말투를 최우선으로 따르되, 현재 문장에 없는 영어 단어와 다른 문장의 예시는 절대 넣지 말라.`
        : `문장: ${full}\n` +
          `이 문장에서 수능에 출제될 수 있는 핵심 문법 포인트를 찾아서 points로 작성하라.\n` +
          `각 포인트마다 원문에서 해당 문법이 적용되는 핵심 구문(2~5단어)을 targetText로 함께 반환하라.\n` +
          `고정 패턴과 태그가 매칭되면 해당 패턴의 형식/말투를 최우선으로 따르되, 현재 문장에 없는 영어 단어와 다른 문장의 예시는 절대 넣지 말라.`;

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
            {
              role: "system",
              content:
                buildAutoSystemPrompt() +
                pinnedData.promptBlock +
                `\n\n[자동생성 추가 규칙]\n` +
                `- 고정 패턴은 태그가 맞을 때 형식/말투를 맞추는 용도로만 사용하라.\n` +
                `- 현재 문장에 없는 영어 단어, 다른 문장의 예시, 다른 문법 포인트를 끌어오지 말 것.\n` +
                `- 선택 구문이 있으면 선택 구문과 직접 연결된 포인트만 작성할 것.\n` +
                learningBlock,
            },
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
          text: stripTrailingFieldLabel(
            stripLeadingTagLabel(
              repairTruncatedSyntaxPhrases(
                sanitizeEndings(oneLine(stripLeadingBullets(stripJsonArtifacts(p.text))))
              )
            )
          ),
          targetText: oneLine(p.targetText),
          tag: normalizeModelTagToUiTag(String(p.tag ?? "")) || detectUiTagFromContent(String(p.text ?? "")),
        }))
        .filter((p) => p.text);

      autoPoints = autoPoints
        .filter((p) => isTargetTextInSentence(p.targetText, full))
        .filter((p) => !isSelectionAuto || isSelectionRelevantTarget(
          full,
          selected,
          p.targetText,
          selectedWordStart,
          selectedWordEnd,
          selectedContextBefore,
          selectedContextAfter,
        ))
        .slice(0, isSelectionAuto ? 1 : 5)
        .map((p) => ({
          text: p.text,
          targetText: p.targetText || (isSelectionAuto ? selected : ""),
          tag: p.tag,
        }));

      if (autoPoints.length === 0) {
        autoPoints = [{
          text: isSelectionAuto
            ? "(선택 구문과 직접 연결된 문법 포인트를 찾지 못했습니다)"
            : "(이 문장에서 주요 문법 포인트를 찾지 못했습니다)",
          targetText: isSelectionAuto ? selected : "",
          tag: "",
        }];
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
      fetchPinnedPatterns(userId, reqAuth),
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
      .map(oneLine)
      .filter(Boolean)
      .map(stripLeadingBullets)
      .map(stripLeadingTagLabel)
      .map(sanitizeEndings)
      .map(repairTruncatedSyntaxPhrases)
      .map(stripLeadingTagLabel)
      .map(stripTrailingFieldLabel)
      .map((p) => applyPinnedPattern(p, tags, pinnedData.byTag));

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
