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
  return text.replace(/(임|됨|있음|함)(?=[.\s/,)~]|$)/g, (match, _g, offset, str) => {
    const prev = str[offset - 1];
    if (prev && /[가-힣]/.test(prev)) return '';
    return match;
  });
}

function stripLeadingBullets(line: string) {
  return String(line ?? "")
    .replace(/^(\s*[\u2460-\u2473])\s*[•·\-\*]\s*/u, "$1 ")
    .replace(/^(\s*\d+[\)\.])\s*[•·\-\*]\s*/u, "$1 ")
    .replace(/^\s*[•·\-\*]\s*/u, "")
    .trim();
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

function applyPinnedPattern(
  content: string,
  hintTags: TagId[],
  pinnedByTag: Map<string, string>,
): string {
  if (!content || pinnedByTag.size === 0) return content;

  const candidates: string[] = [];
  for (const t of hintTags) candidates.push(mapTagIdToUiTag(t));
  candidates.push(detectUiTagFromContent(content));

  for (const candidate of candidates) {
    const pinned = pinnedByTag.get(normalizeTagKey(candidate));
    if (pinned) return pinned;
  }
  return content;
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
- targetText는 반드시 원문에 존재하는 연속된 단어여야 한다.
- targetText는 해당 문법 요소 자체가 시작되는 곳을 가리켜야 한다. 수식 대상(피수식어)이 아님.
  ✅ to부정사 형용사적 용법 → targetText: "to maintain" (to부정사 자체)
  ❌ targetText: "a hard balance" (수식 대상은 안 됨)
  ✅ restrict A to B 구조 → targetText: "to restrict the"
  ✅ 지시대명사 that → targetText: "that is a"
  ✅ 수동태 be p.p. → targetText: "was discovered by"
  ✅ 관계대명사 who가 이끄는 절 → targetText: "who attended the"

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
              },
              required: ["text", "targetText"],
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
async function fetchPinnedPatterns(userId: string | undefined): Promise<PinnedPatternsData> {
  if (!userId) return { promptBlock: "", byTag: new Map() };
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return { promptBlock: "", byTag: new Map() };
    const url = `${supabaseUrl}/rest/v1/syntax_patterns?user_id=eq.${userId}&order=created_at.desc&select=tag,pinned_content`;
    const res = await fetch(url, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
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

    const lines = patterns.map((p: any) => String(p.pinned_content ?? "").trim()).filter(Boolean).join("\n");
    const promptBlock =
      `\n\n[고정 패턴 — 아래 문장을 문체/구조 기준으로 반드시 따를 것]\n${lines}\n` +
      `- 출력에 태그명 접두어(예: 관계대명사:, 5형식:)를 붙이지 말 것.\n` +
      `- 해당 문법 태그의 고정 패턴이 있으면 표현을 우선 적용할 것.`;
    return { promptBlock, byTag };
  } catch {
    return { promptBlock: "", byTag: new Map() };
  }
}

// -----------------------------
// Shared: fetch learning examples
// -----------------------------
async function fetchLearningBlock(userId: string | undefined): Promise<string> {
  if (!userId) return "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return "";
    const url = `${supabaseUrl}/rest/v1/learning_examples?user_id=eq.${userId}&type=eq.syntax&order=created_at.desc&limit=5&select=sentence,ai_draft,final_version`;
    const res = await fetch(url, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
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
    if (selected && countWords(selected) < 3 && full) textToAnalyze = full;

    // ── 자동 생성 모드: 태그 필터 없이 자유 추출 ──
    if (isAutoMode) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const [learningBlock, pinnedData] = await Promise.all([fetchLearningBlock(userId), fetchPinnedPatterns(userId)]);
      const userMessage = `문장: ${full}\n이 문장에서 수능에 출제될 수 있는 핵심 문법 포인트를 찾아서 points로 작성하라. 각 포인트마다 원문에서 해당 문법이 적용되는 핵심 구문(2~5단어)을 targetText로 함께 반환하라.`;

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

      type AutoPoint = { text: string; targetText: string };
      let autoPoints: AutoPoint[] = [];

      if (toolCall?.function?.arguments) {
        const parsed = safeJsonParse(toolCall.function.arguments);
        const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];
        // Handle both object[] and string[] formats
        autoPoints = rawPoints.map((p: any) =>
          typeof p === "string"
            ? { text: p, targetText: "" }
            : { text: String(p?.text ?? ""), targetText: String(p?.targetText ?? "") }
        );
      } else {
        const content = data.choices?.[0]?.message?.content ?? "";
        console.log("No tool_call (auto), trying content fallback:", content.slice(0, 300));
        try {
          const parsed = safeJsonParse(content);
          const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];
          autoPoints = rawPoints.map((p: any) =>
            typeof p === "string"
              ? { text: p, targetText: "" }
              : { text: String(p?.text ?? ""), targetText: String(p?.targetText ?? "") }
          );
        } catch {
          const fallback = oneLine(content);
          autoPoints = fallback ? [{ text: fallback, targetText: "" }] : [];
        }
      }

      // Strip JSON artifacts that leak when response is truncated
      const stripJsonArtifacts = (s: string) =>
        s.replace(/[{}\[\]]/g, "")
         .replace(/"?(text|targetText)"?\s*:/gi, "")
         .replace(/,\s*$/g, "")
         .trim();

      autoPoints = autoPoints
        .map((p) => ({
          text: applyPinnedPattern(
            sanitizeEndings(oneLine(stripLeadingBullets(stripJsonArtifacts(p.text)))),
            [],
            pinnedData.byTag,
          ),
          targetText: oneLine(p.targetText),
        }))
        .filter((p) => p.text);
      autoPoints = autoPoints.slice(0, 5).map((p) => ({
        text: p.text.length > 170 ? p.text.slice(0, 168).trim() + "…" : p.text,
        targetText: p.targetText,
      }));

      if (autoPoints.length === 0) {
        autoPoints = [{ text: "(이 문장에서 주요 문법 포인트를 찾지 못했습니다)", targetText: "" }];
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
    const [learningBlock, pinnedData] = await Promise.all([fetchLearningBlock(userId), fetchPinnedPatterns(userId)]);

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

    const hintModel = useFreestyle ? "google/gemini-3-flash-preview" : "google/gemini-2.5-pro";
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
      .map(sanitizeEndings)
      .map((p) => applyPinnedPattern(p, tags, pinnedData.byTag));

    if (points.length === 0) {
      points = useFreestyle
        ? ["(해당 문장에서 문법 포인트를 찾지 못했습니다)"]
        : ["(힌트 태그에 해당하는 포인트를 문장에서 찾기 어려움) / 드래그 범위를 조금 넓히거나 힌트를 구체화"];
    }

    const maxPts = 1;
    points = points.slice(0, maxPts).map((p) => (p.length > 170 ? p.slice(0, 168).trim() + "…" : p));

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
