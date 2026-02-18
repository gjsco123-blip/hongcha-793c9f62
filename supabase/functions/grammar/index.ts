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
  { id: "REL_OBJ_OMIT", keywords: ["목적격관계대명사", "목관대", "관계대명사 생략", "목적격 생략", "that 생략", "which 생략"], label: "목적격 관계대명사(생략)" },
  { id: "REL_ADV", keywords: ["관계부사", "when", "where", "why", "how(관계부사)"], label: "관계부사" },
  { id: "AGREEMENT", keywords: ["수일치", "단수", "복수", "동사 수일치"], label: "수일치" },
  { id: "NOUN_CLAUSE_THAT", keywords: ["명사절 that", "that절", "that 명사절", "that 생략"], label: "명사절 that(생략)" },
  { id: "NOUN_CLAUSE_WH", keywords: ["의문사절", "간접의문문", "what절", "how절", "why절", "which절", "whether절", "if절(명사절)"], label: "의문사절/간접의문문" },
  { id: "IT_DUMMY_SUBJ", keywords: ["가주어", "진주어", "it 가주어", "to부정사 진주어", "that절 진주어"], label: "가주어/진주어" },
  { id: "IT_DUMMY_OBJ", keywords: ["가목적어", "진목적어", "it 가목적어"], label: "가목적어/진목적어" },
  { id: "FIVE_PATTERN", keywords: ["5형식", "목적격보어", "o.c", "oc", "make o c", "find o c"], label: "5형식(O.C)" },
  { id: "TO_INF", keywords: ["to부정사", "to-v", "to v", "to부정사 용법", "to부정사 목적", "to부정사 형용사적", "to부정사 부사적"], label: "to부정사" },
  { id: "PARTICIPLE_POST", keywords: ["과거분사", "현재분사", "분사 후치", "후치수식", "p.p", "v-ing(형용사)", "분사구"], label: "분사 후치수식" },
  { id: "PARTICIPLE_CLAUSE", keywords: ["분사구문", "접속사 생략", "분사구문(이유)", "분사구문(시간)", "분사구문(양보)"], label: "분사구문" },
  { id: "PASSIVE", keywords: ["수동태", "be p.p", "be pp", "수동"], label: "수동태" },
  { id: "MODAL_PASSIVE", keywords: ["조동사+수동", "can be p.p", "may be p.p", "must be p.p", "will be p.p"], label: "조동사+수동" },
  { id: "PARALLEL", keywords: ["병렬", "and 병렬", "or 병렬", "not only", "both", "either", "neither"], label: "병렬" },
  { id: "PREP_GERUND", keywords: ["전치사+동명사", "by ~ing", "in ~ing", "for ~ing", "without ~ing"], label: "전치사+동명사" },
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


// -----------------------------
// Prompts
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
- 불릿(•)을 절대 붙이지 말 것. (UI가 번호를 붙인다)

[문체 예시(이 톤 유지)]
- 주격 관계대명사 who/which/that이 선행사 ___를 수식하는 관계절을 이끔.
- 목적격 관계대명사 (which/that) 생략 가능 구조임.
- 선행사 ___ 단복수에 따라 관계절 동사 ___가 수일치함.
- 분사(과거/현재)가 명사를 뒤에서 수식하는 후치수식 구조임.
- 조동사 + be p.p. 형태로 수동을 나타냄.`;
}

function buildAutoSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.

[역할]
주어진 문장에서 수능에 출제될 수 있는 핵심 문법 포인트를 자동으로 찾아 설명하라.

[절대 규칙]
- 출력은 반드시 JSON 함수 호출로만 한다.
- points는 1~5개(최대 5). 문장의 핵심 구문부터 우선순위로.
- 각 항목은 한 줄(줄바꿈 금지).
- 하나의 항목에 하나의 포인트만 / 부가설명은 슬래시(/)로 이어서 한 줄 유지.
- 정의/해석/배경설명 금지. 기능 중심으로만.
- 3단어 이상 영어 인용은 who~school처럼 물결(~) 축약.
- 큰따옴표(") 사용 금지.
- 불릿(•)을 절대 붙이지 말 것. (UI가 번호를 붙인다)

[우선 추출 대상]
관계대명사(주격/목적격/생략), 관계부사, 명사절(that/wh-), 가주어/진주어, 가목적어/진목적어,
5형식(O.C), to부정사 용법, 분사 후치수식, 분사구문, 수동태, 조동사+수동, 병렬구조,
전치사+동명사, There is/are, 비교구문, 생략, 수일치

[문체 예시(이 톤 유지)]
- 주격 관계대명사 that이 선행사 pressures를 수식하는 관계절을 이끔
- cause + O + to V(5형식) 구조 / it이 the museum을 가리킴
- what이 이끄는 명사절이 emphasise의 목적어 역할
- 분사(과거/현재)가 명사를 뒤에서 수식하는 후치수식 구조임
- 조동사 + be p.p. 형태로 수동을 나타냄`;
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
    const { sentence, selectedText, userHint, hintTags, mode } = await req.json();

    const full = oneLine(sentence || "");
    const selected = oneLine(selectedText || "").replace(/\s*\/\s*/g, " ").trim();
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

      const userMessage = `문장: ${full}\n이 문장에서 수능에 출제될 수 있는 핵심 문법 포인트를 찾아서 points로 작성하라.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0.2,
          max_tokens: 600,
          messages: [
            { role: "system", content: buildAutoSystemPrompt() },
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
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      console.log("AI response (auto):", JSON.stringify(data.choices?.[0]?.message).slice(0, 500));
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      let points: string[] = [];
      if (toolCall?.function?.arguments) {
        const parsed = safeJsonParse(toolCall.function.arguments);
        points = Array.isArray(parsed?.points) ? parsed.points : [];
      } else {
        const content = data.choices?.[0]?.message?.content ?? "";
        console.log("No tool_call (auto), trying content fallback:", content.slice(0, 300));
        try {
          const parsed = safeJsonParse(content);
          points = Array.isArray(parsed?.points) ? parsed.points : [];
        } catch {
          const fallback = oneLine(content);
          points = fallback ? [fallback] : [];
        }
      }

      points = points.map(oneLine).filter(Boolean).map(stripLeadingBullets);
      points = points.slice(0, 5).map((p) => (p.length > 170 ? p.slice(0, 168).trim() + "…" : p));

      if (points.length === 0) {
        points = ["(이 문장에서 주요 문법 포인트를 찾지 못했습니다)"];
      }

      const syntaxNotes = formatAsLines(points, 5);
      const res: GrammarResponse = { syntaxNotes, detectedTags: [], normalizedHint: "" };
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

    const userMessage = useFreestyle
      ? `전체 문장: ${full}\n` +
        `선택 구문: ${selected || "(없음/전체문장기준)"}\n` +
        `분석 대상: ${textToAnalyze}\n` +
        `사용자 힌트: ${rawHint || "(없음)"}\n` +
        `이 문장에서 힌트와 관련된 핵심 문법 포인트를 찾아서 points로 작성하라.`
      : `전체 문장: ${full}\n` +
        `선택 구문: ${selected || "(없음/전체문장기준)"}\n` +
        `분석 대상: ${textToAnalyze}\n` +
        `허용 태그(TagId): ${tags.join(", ")}\n` +
        `태그 의미:\n${tagsToPromptBlock(tags)}\n` +
        `주의: 위 태그에 해당하는 포인트만 points로 작성하라.`;

    const systemPrompt = useFreestyle ? buildAutoSystemPrompt() : buildHintSystemPrompt();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: useFreestyle ? 0.2 : 0.12,
        max_tokens: 450,
        messages: [
          { role: "system", content: systemPrompt },
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    points = points.map(oneLine).filter(Boolean).map(stripLeadingBullets);

    if (points.length === 0) {
      points = useFreestyle
        ? ["(해당 문장에서 문법 포인트를 찾지 못했습니다)"]
        : ["(힌트 태그에 해당하는 포인트를 문장에서 찾기 어려움) / 드래그 범위를 조금 넓히거나 힌트를 구체화"];
    }

    const maxPts = useFreestyle ? 5 : 3;
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
