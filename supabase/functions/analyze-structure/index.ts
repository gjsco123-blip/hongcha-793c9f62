import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseJson(raw: string): any {
  try { return JSON.parse(raw); } catch { /* fallback */ }
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
    try { return JSON.parse(cleaned); } catch { /* */ }
  }
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1) {
    cleaned = cleaned.substring(objStart, objEnd + 1);
    try { const obj = JSON.parse(cleaned); return obj.structure_steps || [obj]; } catch { /* */ }
  }
  throw new Error("Failed to parse structure JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage, step_count = "auto", regen_steps } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const stepInstruction = step_count === "auto"
      ? "5~6단계로 구조요약하라. 적절한 단계 수를 자동으로 결정하라."
      : `정확히 ${step_count}단계로 구조요약하라.`;

    const regenInstruction = regen_steps && regen_steps.length > 0
      ? `\n\n주의: step 번호 [${regen_steps.join(",")}]만 반환하라. 다른 step은 포함하지 말 것.`
      : "";

    const systemPrompt = `너는 지문을 학생이 빠르게 복기할 수 있도록 ${stepInstruction}하는 엔진이다.

목표:
학생이 시험 전에 "이 글은 이런 흐름이었다"를 떠올릴 수 있게 만들 것.

규칙:
- one_line은 한 줄 요약 (한국어, "~한다" 말투 통일)
- "~한다" 말투란: "~된다", "~한다", "~만든다", "~이끈다" 등 현재형 종결
- "~함", "~임" 같은 음슴체 금지
- "~합니다", "~됩니다" 같은 존댓말 절대 금지
- 분석 용어 최소화 (대조, 비유, 역설 등 쓰지 말 것)
- 25~35자 이내
- evidence는 반드시 원문 연속 2~6단어 그대로 인용
- 추측 금지
- JSON 배열만 출력. 다른 텍스트 금지.
- 지문의 전체 내용이 빠지지 않도록 구성${regenInstruction}

출력 형식:
[{"step":1,"one_line":"...","evidence":"..."},...]`;

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

    const structure_steps = safeParseJson(content);

    return new Response(JSON.stringify({
      step_count: structure_steps.length,
      structure_steps,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-structure error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
