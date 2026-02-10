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

    const systemPrompt = `역할: 한국 고등학생을 위한 영어 지문 해설 선생님 "홍T".
목표: 의역(한국어 번역)만 보면 무슨 말인지 이해 안 가는 학생을 위해, 그 문장이 왜 그런 뜻인지, 지문 전체 맥락에서 어떤 역할을 하는지 쉽게 설명.

핵심 원칙:
- 학생이 "아~ 그런 뜻이구나!" 하고 이해할 수 있도록 쉬운 말로 풀어서 설명
- 지문의 전체 흐름 속에서 이 문장의 역할/위치를 짧게 언급
- 앞뒤 문장과의 논리적 연결 관계 설명 (인과, 대조, 예시, 부연 등)
- 어려운 표현이나 비유가 있으면 쉽게 풀어서 설명
- 문법 설명은 하지 않음 (구문분석 섹션에서 다룸)

출력 스타일:
- 1~3문장으로 간결하게
- 반말 사용 ("~거야", "~뜻이야", "~거지")
- 구어체로 자연스럽게
- 핵심 키워드는 따옴표로 강조 가능

출력하지 말 것:
- 문법 설명
- 단어 뜻 나열
- "이 문장은~" 으로 시작하는 딱딱한 설명
- 원문 영어 인용 (한국어로만 설명)`;

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
