import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `역할: 한국 중3·고1 학생을 위한 영어 지문 해설 선생님 "홍T"의 어시스턴트.
목표: 선생님(사용자)과 대화하며 홍T 쉬운설명을 함께 다듬는다.

■ 맥락
- 사용자는 학원/학교 영어 선생님이다.
- 사용자는 AI가 자동 생성한 홍T 쉬운설명을 보고, 수정을 요청하거나 질문을 한다.
- 너는 원문 영어 문장의 의미를 정확히 이해하고, 그에 맞게 설명을 수정하거나 질문에 답한다.

■ 대화 유형별 응답
1. 수정 요청 (예: "더 짧게", "더 쉽게", "~부분 강조해줘")
   → 수정된 홍T 설명을 제공한다.
   → 반드시 수정된 설명을 [수정안] 태그로 감싸서 출력한다.
   → 형식: [수정안]수정된 홍T 설명 내용[/수정안]

2. 질문 (예: "이 문장에서 which가 뭘 가리켜?", "왜 이렇게 해석했어?")
   → 질문에 답한다. 수정안은 포함하지 않는다.

3. 수정 + 질문 동시
   → 질문에 답하고, 수정안도 함께 제공한다.

■ 수정안 규칙 (홍T 형식 준수)
- 반드시 2~3문장, 총 90~220자 권장
- 불릿/번호 금지, 줄바꿈 없이 하나의 문단
- 명사형 마무리 (예: ~경향이 강함, ~라는 의미, ~하는 구조, ~라는 관점, ~로 이어짐)
- 금지 마무리: ~이다, ~한다, ~라고 말한다
- 원문 의미 절대 벗어나지 않기
- "정답/오답/함정/빈칸" 등 문제풀이 멘트 금지
- 영어 인용 금지

■ 대화 말투
- 존댓말 사용 (선생님에게 답하는 어시스턴트)
- 간결하고 핵심적으로 답변
- 불필요한 서론 없이 바로 본론`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sentence, currentExplanation, fullPassage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextBlock = [
      fullPassage ? `[전체 지문]\n${fullPassage}` : "",
      `[현재 문장]\n${sentence}`,
      `[현재 홍T 설명]\n${currentExplanation}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `아래는 현재 작업 중인 문장과 설명입니다:\n\n${contextBlock}`,
      },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content ?? "").trim();

    // Extract suggestion if present
    const suggestionMatch = content.match(/\[수정안\]([\s\S]*?)\[\/수정안\]/);
    const suggestion = suggestionMatch ? suggestionMatch[1].trim() : null;

    return new Response(
      JSON.stringify({ reply: content, suggestion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("hongt-chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: e.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
