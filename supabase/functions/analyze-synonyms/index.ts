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
  throw new Error("Failed to parse synonyms JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `너는 수능 영어 어휘 전문가이다. 주어진 영어 지문에서 핵심 단어 10~15개를 추출하고, 각 단어의 동의어(synonym)와 반의어(antonym)를 제시하라.

규칙:
- 지문에서 학습 가치가 높은 단어를 선정 (기초 단어 제외)
- synonym: 문맥에서 대체 가능한 동의어 1개
- antonym: 의미상 반대되는 반의어 1개
- 반의어가 명확하지 않은 경우 "—"으로 표기
- JSON 배열만 출력. 다른 텍스트 금지.

출력 형식:
[{"word":"exemplify","synonym":"illustrate","antonym":"obscure"},...]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in response");

    const synonyms = safeParseJson(content);

    return new Response(JSON.stringify({ synonyms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-synonyms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
