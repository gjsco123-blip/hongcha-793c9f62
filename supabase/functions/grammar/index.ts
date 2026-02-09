import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentence, selectedText } = await req.json();
    const textToAnalyze = selectedText || sentence;
    if (!textToAnalyze) {
      return new Response(JSON.stringify({ error: "Missing sentence or selectedText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `역할: 한국 고등학생 영어 시험(수능·모의고사)용 문법 분석 보조 교사.
목표: "설명"이 아니라 "시험에서 바로 써먹는 문법 판단 포인트"를 제시.

출력 개수 규칙:
- 문장당 문법 포인트 최대 2~3개
- 중요하지 않으면 1개만 출력해도 됨
- 애매하면 과감히 생략

출력 형식:
- 한 항목은 반드시 한 줄
- 두 줄 이상 절대 금지
- 각 항목은 ★ 로 시작

문법 용어 사용 규칙:
- 반드시 고등학생이 이미 아는 용어만 사용
  (관계대명사절, 명사절 that, 부사절 if/when, 분사구문, 가주어 it, 수일치, 4형식, 5형식, 수동태, 비교구문 등)
- 문법 정의 설명 금지
- 의미 풀이 장황 금지

문장 스타일 규칙:
- 단정형 문장만 사용
- "~임 / ~구조 / ~사용 / ~주의" 형태 권장
- "~때문에 / ~을 나타내며 / ~라는 의미" 사용 금지
- 교과서·대학 문법 말투 금지

선택 기준:
- 시험에서 헷갈릴 수 있는 지점만 선택
- 해석이 틀어질 수 있는 구조만 선택
- 단순 정보(전치사 뜻, 일반 부사, 당연한 수식)는 제외

출력 예시:
★ 주어는 단수 명사 technology, 동사는 gives → 수일치 주의
★ 관계대명사절이 주어와 동사 사이에 삽입됨 → 거리 멀어짐
★ give 4형식 → 간접목적어(them) + 직접목적어(the tools) 순서

출력하지 말 것:
- 문법 정의
- 장황한 해석 설명
- 논리 전개 설명
- "이 문장은 ~을 말한다" 식의 내용 요약`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `다음 문장을 구문분석하세요: "${textToAnalyze}"` },
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
