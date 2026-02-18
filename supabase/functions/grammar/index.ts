import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TagId =
  | "REL_SUBJ" // 주격 관계대명사
  | "REL_OBJ_OMIT" // 목적격 관계대명사 생략
  | "REL_ADV" // 관계부사
  | "AGREEMENT" // 수일치
  | "NOUN_CLAUSE_THAT" // 명사절 that(생략 포함)
  | "NOUN_CLAUSE_WH" // 의문사절(what/how/why/which 등)
  | "IT_DUMMY_SUBJ" // 가주어/진주어
  | "IT_DUMMY_OBJ" // 가목적어/진목적어
  | "FIVE_PATTERN" // 5형식
  | "TO_INF" // to부정사(기본)
  | "PARTICIPLE_POST" // 분사 후치수식
  | "PARTICIPLE_CLAUSE" // 분사구문
  | "PASSIVE" // 수동태
  | "MODAL_PASSIVE" // 조동사+수동
  | "PARALLEL" // 병렬
  | "PREP_GERUND" // 전치사+동명사
  | "THERE_BE" // There is/are
  | "COMPARISON" // 비교
  | "OMISSION"; // 생략(일반)

type GrammarResponse = {
  syntaxNotes: string; // 기존 UI 호환(필수)
  detectedTags?: TagId[]; // 칩 UI용(옵션)
  normalizedHint?: string; // 서버가 정리한 힌트(옵션)
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

function formatAsBullets(points: string[], maxLines: number) {
  const cleaned = points
    .map((p) => oneLine(p))
    .filter(Boolean)
    .map((p) => p.replace(/^•\s*/g, ""));
  return cleaned
    .slice(0, maxLines)
    .map((p) => `• ${p}`)
    .join("\n");
}

// -----------------------------
// 1) 자유 입력 힌트 → 표준 태그 자동 정규화
// -----------------------------
const TAG_RULES: Array<{
  id: TagId;
  // 이 키워드들 중 하나라도 포함되면 태그로 인식
  keywords: string[];
  // 표시용 라벨(프롬프트에 태그 설명으로 같이 전달)
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
  // 중복 제거
  return Array.from(new Set(found));
}

function tagsToPromptBlock(tags: TagId[]) {
  const map = new Map<TagId, string>();
  for (const r of TAG_RULES) map.set(r.id, r.label);
  return tags.map((t) => `${t}: ${map.get(t) ?? t}`).join("\n");
}

/**
 * hint 모드 필터:
 * - 모델이 태그 밖 포인트를 쓰면 제거하기 위해,
 * - 포인트 문자열에 태그 라벨 또는 태그 관련 키워드가 포함되는지 확인.
 */
function passesTagFilter(point: string, tags: TagId[]) {
  const p = oneLine(point);
  if (!p) return false;

  // 태그별로 허용 키워드 세트(최소)
  const allow: Record<TagId, string[]> = {
    REL_SUBJ: ["주격 관계대명사", "who", "which", "that"],
    REL_OBJ_OMIT: ["목적격 관계대명사", "관계대명사 생략", "목적격", "which/that", "that/which", "생략"],
    REL_ADV: ["관계부사", "when", "where", "why"],
    AGREEMENT: ["수일치", "단수", "복수"],
    NOUN_CLAUSE_THAT: ["명사절", "that", "목적어", "주어", "that 생략"],
    NOUN_CLAUSE_WH: ["의문사절", "간접의문문", "what", "how", "why", "which", "whether", "if"],
    IT_DUMMY_SUBJ: ["가주어", "진주어", "it", "to부정사", "that절"],
    IT_DUMMY_OBJ: ["가목적어", "진목적어", "it"],
    FIVE_PATTERN: ["5형식", "O.C", "목적격보어"],
    TO_INF: ["to부정사", "to-v", "to V", "형용사적", "부사적", "목적", "보어"],
    PARTICIPLE_POST: ["분사", "과거분사", "현재분사", "후치수식", "p.p.", "v-ing"],
    PARTICIPLE_CLAUSE: ["분사구문", "접속사 생략"],
    PASSIVE: ["수동태", "be p.p.", "be p.p", "수동"],
    MODAL_PASSIVE: ["조동사", "can", "may", "must", "will", "be p.p", "수동"],
    PARALLEL: ["병렬", "and", "or", "not only", "both", "either", "neither"],
    PREP_GERUND: ["전치사", "동명사", "by", "in", "for", "without", "~ing"],
    THERE_BE: ["There", "there", "is/are", "유도부사"],
    COMPARISON: ["비교", "비교급", "최상급", "as", "than", "the 비교급"],
    OMISSION: ["생략", "that 생략", "관계사 생략", "접속사 생략"],
  };

  return tags.some((t) => allow[t]?.some((kw) => p.includes(kw)));
}

// -----------------------------
// Prompts (hint 강제)
// -----------------------------
function buildHintSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.

[중요]
사용자가 제공한 "허용 태그(TagId)"에 해당하는 문법 포인트만 작성하라.
허용 태그 밖의 포인트는 절대 추가하지 말 것.

[절대 규칙]
- 출력은 반드시 JSON 함수 호출로만 한다.
- points는 1~3개(최대 3).
- 각 항목은 한 줄(줄바꿈 금지).
- 하나의 항목에 하나의 포인트만 / 부가설명은 슬래시(/)로 이어서 한 줄 유지.
- 정의/해석/배경설명 금지. 기능 중심으로만.
- 3단어 이상 영어 인용은 who~school처럼 축약.
- 큰따옴표(") 사용 금지.

[문체 예시(이 톤 유지)]
- 주격 관계대명사 who/which/that이 선행사 ___를 수식하는 관계절을 이끔.
- 목적격 관계대명사 (which/that) 생략 가능 구조임.
- 선행사 ___ 단복수에 따라 관계절 동사 ___가 수일치함.
- 분사(과거/현재)가 명사를 뒤에서 수식하는 후치수식 구조임.
- 조동사 + be p.p. 형태로 수동을 나타냄.`;
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

// -----------------------------
// Server
// -----------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentence, selectedText, userHint, hintTags } = await req.json();

    const full = oneLine(sentence || "");
    const selected = oneLine(selectedText || "");
    const rawHint = oneLine(userHint || "");

    if (!full && !selected) {
      return new Response(JSON.stringify({ error: "Missing sentence or selectedText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 분석 대상(선택구문이 너무 짧으면 전체문장 fallback)
    let textToAnalyze = selected || full;
    if (selected && countWords(selected) < 3 && full) textToAnalyze = full;

    // 2) 태그 결정: 프론트에서 hintTags 배열이 오면 우선 사용, 없으면 userHint에서 자동 추출
    let tags: TagId[] = [];
    if (Array.isArray(hintTags) && hintTags.length > 0) {
      tags = hintTags as TagId[];
    } else {
      tags = detectTagsFromHint(rawHint);
    }

    // 태그가 하나도 없으면: "자동 모드"로 해버리면 또 흔들림.
    // 여기서는 최소한 안내 문구를 주는 게 교재 제작엔 더 안전.
    if (tags.length === 0) {
      const res: GrammarResponse = {
        syntaxNotes: "• (힌트가 너무 짧거나 인식되지 않았습니다) 예: 목관대 생략 / 수일치 / 과거분사",
        detectedTags: [],
        normalizedHint: rawHint,
      };
      return new Response(JSON.stringify(res), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userMessage =
      `전체 문장: ${full}\n` +
      `선택 구문: ${selected || "(없음/전체문장기준)"}\n` +
      `분석 대상: ${textToAnalyze}\n` +
      `허용 태그(TagId): ${tags.join(", ")}\n` +
      `태그 의미:\n${tagsToPromptBlock(tags)}\n` +
      `주의: 위 태그에 해당하는 포인트만 points로 작성하라.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        temperature: 0.12,
        max_tokens: 450,
        messages: [
          { role: "system", content: buildHintSystemPrompt() },
          { role: "user", content: userMessage },
        ],
        tools,
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let points: string[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = safeJsonParse(toolCall.function.arguments);
      points = Array.isArray(parsed?.points) ? parsed.points : [];
    } else {
      const fallback = oneLine(data.choices?.[0]?.message?.content ?? "");
      points = fallback ? [fallback] : [];
    }

    // 3) 후처리: 한 줄화 + 태그 필터 + 최대 3개
    points = points.map(oneLine).filter(Boolean);

    // hint 기반 2중 안전장치: 태그와 무관한 포인트 제거
    points = points.filter((p) => passesTagFilter(p, tags));

    // 그래도 0개면: 최소한 첫 1개라도 보여주되(교재 제작 흐름 끊김 방지), 아주 짧게
    if (points.length === 0) {
      points = ["(힌트 태그에 해당하는 포인트를 문장에서 찾기 어려움) / 드래그 범위를 조금 넓히거나 힌트를 구체화"];
    }

    // 길이/개수 제한
    points = points.slice(0, 3).map((p) => (p.length > 170 ? p.slice(0, 168).trim() + "…" : p));

    const syntaxNotes = formatAsBullets(points, 3);

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
