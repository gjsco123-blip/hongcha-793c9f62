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
  throw new Error("Failed to parse JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word, passage } = await req.json();
    if (!word || !passage) throw new Error("Missing word or passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `너는 한국 고등학생용 영어 어휘 분석 엔진이다.

주어진 영어 단어를 지문 맥락에서 분석하여 JSON으로만 출력하라.

출력 형식:
{"word":"...","pos":"동/명/형/부/접/전 중 하나","meaning_ko":"짧은 직역 (한국어)","in_context":"원문에서 연속된 2~6단어 그대로 인용"}

규칙:
- pos는 동/명/형/부/접/전 중 하나만
- 과거분사가 명사를 수식하거나 보어로 쓰이면 '형'
- meaning_ko는 짧고 정확한 직역
- in_context는 반드시 원문에서 해당 단어가 포함된 연속 2~6단어를 그대로 인용
- JSON 객체만 출력. 다른 텍스트 금지.`;

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
          { role: "user", content: `단어: ${word}\n\n지문:\n${passage}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
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
    console.error("analyze-single-vocab error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
