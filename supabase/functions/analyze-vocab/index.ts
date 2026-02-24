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
    try { return JSON.parse(cleaned); } catch { /* fallback */ }
  }
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1) {
    cleaned = cleaned.substring(objStart, objEnd + 1);
    try { return JSON.parse(`[${cleaned}]`); } catch { /* */ }
    try { const obj = JSON.parse(cleaned); return obj.vocab || [obj]; } catch { /* */ }
  }
  throw new Error("Failed to parse vocab JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage, count = 30, exclude_words = [], difficulty = "고등" } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `너는 한국 ${difficulty} 학생용 영어 독해 자료의 어휘를 뽑는 엔진이다.

지문(passage)을 읽고 중요한 어휘 ${count}개를 JSON으로만 출력하라.

각 항목:
- word: 영단어 (반드시 단일 단어만. 콜로케이션/복합 명사 금지. "historical fiction" → "historical"과 "fiction" 각각 별도 항목으로)
- pos: 동/명/형/부/접/전 중 하나만 (주의: 과거분사가 명사를 수식하거나 보어로 쓰이면 반드시 '형'으로 표기. 과거분사를 '동'으로 표기하지 말 것)
- meaning_ko: 짧은 직역 (한국어)
- in_context: 반드시 원문에서 연속된 2~6단어 그대로 인용

절대 규칙:
- JSON 배열만 출력. 다른 텍스트 금지.
- 정확히 ${count}개 반드시 맞출 것
- word는 반드시 공백 없는 단일 단어여야 한다. 2단어 이상 조합 절대 금지.
- exclude_words에 포함된 단어는 절대 포함하지 말 것: [${exclude_words.join(", ")}]
- 단순 반복 단어 제외
- 주제 이해에 기여하지 않는 단어 제외
- a, the, is, are 등 기능어 제외

출력 형식:
[{"word":"...","pos":"동","meaning_ko":"...","in_context":"..."},...]`;

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

    const vocab = safeParseJson(content);

    return new Response(JSON.stringify({ vocab }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-vocab error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
