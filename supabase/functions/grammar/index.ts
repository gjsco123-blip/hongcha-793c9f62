import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentence } = await req.json();
    if (!sentence) {
      return new Response(JSON.stringify({ error: "Missing sentence" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `당신은 한국 수능/고등학교 영어 시험 전문 구문분석 교사입니다.

주어진 영어 문장에서 수능에 출제될 만한 핵심 문법/구문 포인트를 정확히 2~3개만 골라 분석하세요.

우선순위가 높은 구문 유형:
- 관계사절 (관계대명사/관계부사)
- 명사절 (that절, what절, whether절)
- 부사절 (시간/조건/양보/이유)
- 분사구문 (현재분사/과거분사)
- to부정사 (명사적/형용사적/부사적 용법)
- 가주어/진주어 구문
- 강조/도치 구문
- 비교 구문
- 수동태
- 동격
- 삽입구/삽입절

각 항목은 다음 형식으로 작성:
• [구문유형] 해당 부분 인용 → 간결한 한국어 설명

규칙:
- 반드시 2~3개만 선택
- 수능 기출에 자주 나오는 구문 위주
- 한국어로 작성
- 각 분석은 1~2문장으로 간결하게`;

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
          { role: "user", content: `다음 문장을 구문분석하세요: "${sentence}"` },
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
      JSON.stringify({ syntaxNotes: content.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("grammar error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
