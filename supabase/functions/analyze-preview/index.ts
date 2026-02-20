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

지문을 읽고 아래 두 항목을 JSON으로만 출력하라.

1. summary: 지문 전체의 핵심 요약 (한국어, 2~3줄, 80~120자)
   - 문장 단위 해석 금지
   - 예시 세부 내용 포함 금지
   - 중심 개념만 압축

2. exam_block:
   - topic: 주제 (한국어, 1문장 또는 명사구, "~에 대한 글" 허용)
   - title: 제목 (영어, 5~9단어, 문학적 표현 금지, 수능 스타일)
   - one_sentence_summary: 한 문장 요약 (영어, 25~40단어, 세부 예시 포함 금지, 수능 선택지 수준)

절대 규칙:
- JSON 객체만 출력. 다른 텍스트 금지.
- 분석 용어 금지 (대조, 예시, 역설 등)

출력 형식:
{"summary":"...","exam_block":{"topic":"...","title":"...","one_sentence_summary":"..."}}`;

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
