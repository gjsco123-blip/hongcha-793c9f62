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
- 각 항목은 • 로 시작
- 각 항목은 반드시 한 줄로 작성 (줄바꿈 금지)
- 항목 간에는 줄바꿈으로 구분

문법 용어 사용 규칙:
- 고등학생이 아는 용어 사용 (관계대명사절, 명사절, 부사절, 분사구문, 가주어 it, 수일치, 4형식, 5형식, 수동태, 비교구문 등)
- 문법 정의 설명 금지
- 해당 문장의 구체적 단어를 반드시 인용하며 설명

문장 스타일 규칙:
- 단정형 문장: "~임 / ~함 / ~이끔 / ~사용함 / ~수식함" 형태
- "~때문에 / ~을 나타내며" 사용 금지
- 교과서·대학 문법 말투 금지
- 문장의 실제 단어를 괄호로 인용하여 구체적으로 설명
- 연속된 영어 단어를 인용할 때, 3단어 이상이면 첫 단어~마지막 단어로 축약 (예: "parenting improves when it is practiced as a skilled craft" → "parenting~craft")
- 2단어 이하는 그대로 표기

선택 기준:
- 시험에서 헷갈릴 수 있는 지점만 선택
- 해석이 틀어질 수 있는 구조만 선택
- 단순 정보(전치사 뜻, 일반 부사, 당연한 수식)는 제외

출력 예시:
• 주어는 단수 명사 technology, 동사는 gives임. 주어와 동사 사이에 관계대명사절이 삽입되어 수일치에 주의해야 함.
• gives는 4형식 동사로, 간접목적어(them)와 직접목적어(the tools)를 차례로 가짐.
• to act~와 to serve~가 and로 병렬 연결되어 the tools를 수식하는 형용사적 용법으로 쓰임.
• allow + O + to부정사 = 5형식. citizens가 O, to retake가 O.C임.
• 과거분사구 caused by~가 disruptions를 뒤에서 수식함. (which were) caused~에서 주격관대+be동사가 생략된 형태임.
• 관계대명사 what은 선행사를 포함하여 '~하는 것'으로 해석되며, 전치사 of의 목적어 역할을 하는 명사절을 이끔.

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
        model: "google/gemini-2.5-flash",
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
