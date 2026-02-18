import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// -----------------------------
// Utils
// -----------------------------
function oneLine(s: string) {
  return String(s ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // remove markdown wrappers if any
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

function countWords(text: string) {
  return oneLine(text).split(" ").filter(Boolean).length;
}

/**
 * 힌트 문자열을 "허용 키워드" 집합으로 정리.
 * 예: "목관대 생략, 동사 수일치 / 과거분사" -> ["목관대", "생략", "동사", "수일치", "과거분사"]
 */
function parseHintTokens(userHint: string): string[] {
  const raw = oneLine(userHint)
    .replace(/[•\-\*\(\)\[\]\{\}]/g, " ")
    .replace(/[\/,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];
  // 너무 흔한 조사/군더더기 제거는 최소만
  const stop = new Set(["및", "또는", "그리고", "or", "and", "the", "a", "an"]);
  return raw
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .filter((t) => !stop.has(t));
}

/**
 * 힌트 기반 모드에서:
 * - 모델이 몰래 추가한 포인트를 최대한 걸러내기 위한 서버 필터
 * - 규칙: 각 포인트 문장에 hint 토큰 중 1개 이상 포함되어야 통과
 * - 단, 사용자가 "목관대 생략"처럼 약어를 쓰면, "목적격 관계대명사"와 매칭을 돕기 위해 약간의 확장 동의어를 제공
 */
function buildHintAliases(tokens: string[]): string[] {
  const aliases: string[] = [];
  for (const t of tokens) {
    aliases.push(t);

    // 자주 쓰는 약어/표현 보강
    if (t.includes("목관대") || t.includes("목적격")) {
      aliases.push("목적격 관계대명사");
      aliases.push("목적격 관계대명사 생략");
      aliases.push("관계대명사 목적격");
    }
    if (t.includes("주관대") || t.includes("주격")) {
      aliases.push("주격 관계대명사");
    }
    if (t.includes("관계사")) {
      aliases.push("관계대명사");
      aliases.push("관계부사");
      aliases.push("관계절");
    }
    if (t.includes("명사절")) {
      aliases.push("that절");
      aliases.push("what절");
      aliases.push("whether절");
      aliases.push("간접의문문");
    }
    if (t.includes("부사절")) {
      aliases.push("접속사");
      aliases.push("양보");
      aliases.push("이유");
      aliases.push("조건");
      aliases.push("시간");
    }
    if (t.includes("수일치")) {
      aliases.push("수일치");
      aliases.push("단수");
      aliases.push("복수");
    }
    if (t.includes("과거분사")) {
      aliases.push("p.p.");
      aliases.push("분사구");
      aliases.push("과거분사구");
    }
    if (t.includes("현재분사")) {
      aliases.push("v-ing");
      aliases.push("현재분사구");
    }
    if (t.includes("to부정사") || t === "to") {
      aliases.push("to부정사");
      aliases.push("to-v");
      aliases.push("to V");
    }
    if (t.includes("동명사")) {
      aliases.push("동명사");
      aliases.push("v-ing");
    }
    if (t.includes("분사구문")) {
      aliases.push("분사구문");
      aliases.push("접속사 생략");
    }
    if (t.includes("수동")) {
      aliases.push("수동태");
      aliases.push("be p.p.");
      aliases.push("조동사 + be p.p.");
    }
    if (t.includes("5형식")) {
      aliases.push("5형식");
      aliases.push("O.C");
      aliases.push("목적격보어");
    }
    if (t.includes("가주어") || t.includes("진주어")) {
      aliases.push("가주어");
      aliases.push("진주어");
      aliases.push("it");
      aliases.push("to부정사");
      aliases.push("that절");
    }
    if (t.includes("병렬")) {
      aliases.push("병렬");
      aliases.push("and");
      aliases.push("or");
      aliases.push("but");
    }
    if (t.includes("대동사")) {
      aliases.push("대동사");
      aliases.push("do");
      aliases.push("does");
      aliases.push("did");
    }
    if (t.includes("there")) {
      aliases.push("There is/are");
      aliases.push("유도부사");
    }
  }
  // 중복 제거
  return Array.from(new Set(aliases.map(oneLine).filter(Boolean)));
}

function passesHintFilter(point: string, hintAliases: string[]) {
  const p = oneLine(point);
  if (!p) return false;
  // 최소 1개 alias가 포함되면 통과
  return hintAliases.some((a) => a && p.includes(a));
}

function formatAsBullets(points: string[], maxLines: number) {
  const cleaned = points
    .map((p) => oneLine(p))
    .filter(Boolean)
    .map((p) => p.replace(/^•\s*/g, "")); // 혹시 모델이 bullet 붙여도 제거 후 서버에서 다시 붙임

  const sliced = cleaned.slice(0, maxLines);
  return sliced.map((p) => `• ${p}`).join("\n");
}

// -----------------------------
// Prompts
// -----------------------------
function buildBaseSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.
입력된 문장 1개에 대해 시험 출제 관점에서 핵심 구문만 간결하게 분석하라.

[절대 규칙]
1. 문장당 2~4개 핵심 문법 포인트만 제시 (단순문은 1~2개).
2. 시험에 나올 구조만 선택할 것.
3. 정의 설명 금지.
4. 의미 확장/배경 설명 금지.
5. 기능 중심으로만 설명.
6. 각 항목은 반드시 "한 줄" (줄바꿈 금지).
7. 하나의 항목에 하나의 포인트만 담을 것. 부가 설명(수일치/수식 범위 등)은 슬래시(/)로 이어서 한 줄에 작성.
8. 해석 작성 금지.
9. 불필요한 문장 추가 금지.
10. 번호 매기지 말 것.

[우선 분석 대상 구조]
관계대명사절/관계부사절(수일치 포함), 명사절(that/what/whether/간접의문문), 부사절 접속사(While/As/Because/Unless/If/Otherwise 등),
가주어/진주어, 가목적어/진목적어, 5형식, to부정사(목적/보어/형용사적/부사적), 동명사/분사구문,
병렬 구조, 수동태/조동사+수동, 비교구문, 대동사 do/does, There is/are, 생략 구조, 전치사+동명사

[출력은 반드시 JSON 함수 호출로만 제공]`;
}

/**
 * 핵심: hint 모드는 "사용자가 적은 포인트만" 다루게 만들고,
 * 서버에서도 hint 토큰 필터로 2중 안전장치.
 */
function buildHintSystemPrompt() {
  return `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.
사용자가 전체 문장과 그 안에서 특정 구문을 선택하고, '분석할 문법 포인트(힌트)'를 제시했다.

[핵심 지시]
1. 전체 문장 맥락을 먼저 확인한 뒤, 선택 구문이 문장 안에서 어떤 역할인지 파악한다.
2. 사용자가 제시한 힌트에 해당하는 문법 포인트만 설명한다. (힌트 밖 포인트는 절대 추가 금지)
3. 정의/배경/의미 확장/해석 금지. 기능 중심으로만, 교재 스타일로 간결하게 쓴다.
4. 각 항목은 반드시 "한 줄" (줄바꿈 금지). 부가 설명은 슬래시(/)로 이어서 한 줄 유지.
5. 3단어 이상 영어 구문 인용은 who~school 처럼 축약 표기만 사용. 큰따옴표(") 금지.

[출력은 반드시 JSON 함수 호출로만 제공]`;
}

// -----------------------------
// Tool schema (Function calling)
// -----------------------------
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
            description: "구문분석 핵심 포인트 목록. 각 항목은 한 줄. (문장당 2~4개 / 단순문 1~2개).",
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
    const { sentence, selectedText, userHint } = await req.json();
    const hasHint = Boolean(oneLine(userHint || ""));

    // 선택 구문이 너무 짧으면(1~2단어 등) 모델이 억지 분석하기 쉬움 -> 문장 전체로 fallback
    const selected = oneLine(selectedText || "");
    const full = oneLine(sentence || "");

    let textToAnalyze = selected || full;
    if (!textToAnalyze) {
      return new Response(JSON.stringify({ error: "Missing sentence or selectedText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // hint 모드일 때 선택 구문이 너무 짧으면 전체 문장으로 분석하되, 힌트만 반영하도록
    if (hasHint && selected && countWords(selected) < 3 && full) {
      textToAnalyze = full;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = hasHint ? buildHintSystemPrompt() : buildBaseSystemPrompt();

    // 힌트 토큰/별칭 준비(서버 필터용)
    const hintTokens = hasHint ? parseHintTokens(userHint) : [];
    const hintAliases = hasHint ? buildHintAliases(hintTokens) : [];

    const userMessage = hasHint
      ? `전체 문장: ${full}\n선택 구문: ${selected || "(없음/전체문장기준)"}\n분석 대상: ${textToAnalyze}\n힌트(이것만 다룰 것): ${oneLine(userHint)}`
      : `다음 문장을 구문분석하세요: ${textToAnalyze}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 구문분석은 flash보다 pro/gpt-5가 유리. 우선 pro로 추천.
        model: "google/gemini-2.5-pro",
        temperature: 0.15,
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
    if (!toolCall?.function?.arguments) {
      // 혹시라도 tool-call 안 나오면 fallback로 텍스트를 bullet로 감싸기
      const fallback = oneLine(data.choices?.[0]?.message?.content ?? "");
      const syntaxNotes = fallback ? `• ${fallback}` : "";
      return new Response(JSON.stringify({ syntaxNotes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = safeJsonParse(toolCall.function.arguments);
    let points: string[] = Array.isArray(parsed?.points) ? parsed.points : [];

    // 정리: 한 줄화 + 공백 정리
    points = points.map(oneLine).filter(Boolean);

    // --- 핵심: hint 모드 강제 필터 ---
    if (hasHint) {
      // 1) 힌트 관련 없는 포인트 제거
      const filtered = points.filter((p) => passesHintFilter(p, hintAliases));

      // 2) 너무 많이 제거돼서 0개가 되면: 모델이 힌트를 무시한 것
      // -> 최소한 “힌트만 다시” 요청하는 1회 재시도
      if (filtered.length === 0) {
        const retry = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            temperature: 0.1,
            messages: [
              { role: "system", content: buildHintSystemPrompt() },
              {
                role: "user",
                content:
                  `너의 이전 출력은 힌트와 무관했으므로 모두 폐기한다.\n` +
                  `아래 힌트에 해당하는 포인트만 1~3개로 다시 작성하라.\n` +
                  `전체 문장: ${full}\n선택 구문: ${selected || "(없음/전체문장기준)"}\n분석 대상: ${textToAnalyze}\n힌트(이것만): ${oneLine(userHint)}\n` +
                  `주의: 힌트 밖 포인트 절대 추가 금지.`,
              },
            ],
            tools,
            tool_choice: { type: "function", function: { name: "syntax_result" } },
          }),
        });

        if (retry.ok) {
          const retryData = await retry.json();
          const retryToolCall = retryData.choices?.[0]?.message?.tool_calls?.[0];
          if (retryToolCall?.function?.arguments) {
            const retryParsed = safeJsonParse(retryToolCall.function.arguments);
            let retryPoints: string[] = Array.isArray(retryParsed?.points) ? retryParsed.points : [];
            retryPoints = retryPoints.map(oneLine).filter(Boolean);
            points = retryPoints.filter((p) => passesHintFilter(p, hintAliases));
          } else {
            points = filtered;
          }
        } else {
          points = filtered;
        }
      } else {
        points = filtered;
      }
    }

    // 길이/개수 고정
    // base: 2~4 (단순문이면 1~2는 모델이 판단) -> 서버는 max 4만 강제
    // hint: 1~3 (사용자가 고른 포인트만이므로 보통 1~3)
    const maxLines = hasHint ? 3 : 4;
    points = points.slice(0, maxLines);

    // 너무 긴 문장은 자르기(교재 스타일 유지)
    // 한 줄이 과하게 길면 “/” 기준으로 쪼개지게 프롬프트에서 유도했지만,
    // 혹시 길면 서버에서 강제 축약
    points = points.map((p) => {
      const s = oneLine(p);
      return s.length > 160 ? s.slice(0, 158).trim() + "…" : s;
    });

    const syntaxNotes = formatAsBullets(points, maxLines);

    return new Response(JSON.stringify({ syntaxNotes }), {
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
