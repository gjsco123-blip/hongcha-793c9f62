import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseJson(raw: string): any {
  try { return JSON.parse(raw); } catch { /* fallback */ }
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1) {
    cleaned = cleaned.substring(objStart, objEnd + 1);
    try { return JSON.parse(cleaned); } catch { /* */ }
  }
  throw new Error("Failed to parse preview JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `너는 한국 고등학생용 영어 독해 지문의 프리뷰를 생성하는 엔진이다.

지문을 읽고 아래 항목을 JSON으로만 출력하라.

1. summary (Key Summary): 지문 전체의 핵심 요약 (한국어)
   - 반드시 정확히 3문장, 줄바꿈 \\n으로 구분
   - Key Summary는 도식적 요약이 아니라, 학생이 자연스럽게 읽으면서 전체 논지를 이해할 수 있는 이야기형 요약이다.
   - 구조를 나열하지 말고, 갈등 또는 핵심 긴장 구조가 드러나게 하라.
   - 딱딱한 보고서체 금지 ("이는 ~이다", "따라서", "결론적으로" 금지)
   - 자연스럽게 읽히는 이야기 흐름으로 작성
   - 1문장: 글이 다루는 대상 (무엇에 대한 글인지)
   - 2문장: 어떻게 설명하는지 (전개 방식, 역설/갈등 구조 포함)
   - 3문장: 그래서 왜 중요한지 (의미/시사점)
   - 문장 단위 해석 금지
   - 예시 세부 내용 포함 금지
   - 설명 나열 금지
   - 문장 간 자연스럽게 연결할 것

2. exam_block:
   - topic: 주제 (영어, 1문장 또는 명사구)
   - topic_ko: topic의 한국어 번역
   - title: 제목 (영어, 5~9단어, 문학적 표현 금지, 수능 스타일, sentence case — 첫 단어의 첫 글자만 대문자, 나머지는 소문자)
   - title_ko: title의 한국어 번역
   - one_sentence_summary: 한 문장 요약 (영어, 25~40단어, 세부 예시 포함 금지, 수능 선택지 수준)
   - one_sentence_summary_ko: one_sentence_summary의 한국어 번역

절대 규칙:
- JSON 객체만 출력. 다른 텍스트 금지.
- 분석 용어 금지 (대조, 예시, 역설 등)
- summary는 반드시 \\n으로 구분된 3줄이어야 한다.
- 의미 왜곡 금지: 원문에 없는 주장, 평가, 비판, 예측을 추가하지 말 것.
- 원문의 의미 강도를 강화하거나 약화하지 말 것.
- 추론 확장 금지. 해석은 원문 범위 안에서만 할 것.

출력 형식:
{"summary":"1줄\\n2줄\\n3줄","exam_block":{"topic":"...","topic_ko":"...","title":"...","title_ko":"...","one_sentence_summary":"...","one_sentence_summary_ko":"..."}}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: passage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in response");

    const parsed = safeParseJson(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-preview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
