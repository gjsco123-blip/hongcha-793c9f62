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

    const systemPrompt = `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.
입력된 문장 1개에 대해 시험 출제 관점에서 핵심 구문만 간결하게 분석하라.

[절대 규칙]
1. 문장당 2~4개 핵심 문법 포인트만 제시 (단순문은 1~2개).
2. 시험에 나올 구조만 선택할 것.
3. 정의 설명 금지.
4. 의미 확장/배경 설명 금지.
5. 기능 중심으로만 설명.
6. 모든 문장은 한 줄로 작성.
7. 불필요한 문장 추가 금지.
8. 해석 작성 금지.
9. 번호 매기지 말 것.
10. 각 항목은 • 로 시작.

[우선 분석 대상 구조]
관계대명사절/관계부사절(수일치 포함), 명사절(that/what/whether/간접의문문), 부사절 접속사(While/As/Because/Unless/If/Otherwise 등), 가주어/진주어, 가목적어/진목적어, 5형식, to부정사(목적/보어/형용사적/부사적), 동명사/분사구문, 병렬 구조, 수동태/조동사+수동, 비교구문, 대동사 do/does, There is/are, 생략 구조, 전치사+동명사

[출력 말투 템플릿 – 반드시 이 스타일 유지]
- "주격 관계대명사 that/who/which가 선행사 ___를 수식하는 형용사절을 이룸."
- "선행사 ___가 단수/복수이므로 관계절 동사 ___가 단수형/복수형으로 수일치함."
- "가주어 it, 진주어 to-v 구문으로 to-v가 문장의 실제 주어 역할을 함."
- "5형식 동사 ___ + O + O.C 구조임."
- "to부정사가 목적/결과/형용사적 용법으로 사용됨."
- "전치사 + 동명사구가 수단/방법/목적을 나타냄."
- "조동사 + be p.p. 형태로 수동의 의미를 나타냄."
- "삽입된 부사구는 문장 전체를 수식함."
- "병렬 구조로 두 요소가 and/or/but으로 연결됨."
- "접속사 ___가 이유/조건/양보/시간의 부사절을 이룸."

[스타일 고정 예시]
문장: There are few of us who don't want to make time.
출력:
• There are + 복수명사 구문(유도부사 there)임.
• 주격 관계대명사 who가 선행사 few of us를 수식함.
• 선행사가 복수 취급이므로 관계절 동사 don't가 복수형으로 수일치함.

문장: The switch happens by sending emails or clicking buttons.
출력:
• 전치사 by 뒤에 동명사가 와서 수단을 나타냄.
• sending과 clicking이 or로 병렬 연결됨.

문장: This means a careful act may be required.
출력:
• 동사 means의 목적어로 that이 생략된 명사절이 옴.
• 조동사 may + be p.p. 형태의 수동태임.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
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
