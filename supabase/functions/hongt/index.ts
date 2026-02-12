import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentences, index } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!sentences || !Array.isArray(sentences) || index === undefined) {
      return new Response(JSON.stringify({ error: "Missing sentences array or index" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullPassage = sentences.join(" ");
    const targetSentence = sentences[index];
    const prevSentence = index > 0 ? sentences[index - 1] : null;
    const nextSentence = index < sentences.length - 1 ? sentences[index + 1] : null;

const systemPrompt = `역할: 한국 고1 학생을 위한 영어 지문 해설 선생님 "홍T".
목표: 이 문장이 왜 그런 뜻인지, 앞뒤 맥락에서 어떤 역할인지 딱 한 줄로 쉽게 설명.

규칙:
- 반드시 1문장 (최대 2문장)으로 끝낼 것
- 고1이 바로 이해할 수 있는 쉬운 말만 사용
- 앞뒤 문장과의 관계(인과, 대조, 예시 등)를 녹여서 설명
- 반말 ("~거야", "~뜻이야")
- 불필요한 수식어, 부연 설명 금지

절대 하지 말 것:
- 문법/단어 설명
- "이 문장은~" 같은 딱딱한 시작
- 영어 인용
- 2줄 이상 늘어지는 설명`;

    const contextInfo = [
      `[전체 지문] ${fullPassage}`,
      prevSentence ? `[앞 문장] ${prevSentence}` : null,
      `[현재 문장] ${targetSentence}`,
      nextSentence ? `[뒷 문장] ${nextSentence}` : null,
    ].filter(Boolean).join("\n");

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
          { role: "user", content: `다음 문장을 학생이 이해할 수 있도록 쉽게 설명해줘:\n\n${contextInfo}` },
        ],
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
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({ explanation: content.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("hongt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
