import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentence, selectedText, userHint } = await req.json();
    const textToAnalyze = selectedText || sentence;
    // sentence = 전체 문장, textToAnalyze = 선택된 구문 또는 전체 문장
    if (!textToAnalyze) {
      return new Response(JSON.stringify({ error: "Missing sentence or selectedText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const baseSystemPrompt = `너는 한국 고등학교 수능 대비 영어 '구문분석' 교재를 제작하는 전문 강사다.
입력된 문장 1개에 대해 시험 출제 관점에서 핵심 구문만 간결하게 분석하라.

[절대 규칙]
1. 문장당 2~4개 핵심 문법 포인트만 제시 (단순문은 1~2개).
2. 시험에 나올 구조만 선택할 것.
3. 정의 설명 금지.
4. 의미 확장/배경 설명 금지.
5. 기능 중심으로만 설명.
6. 각 항목은 • 로 시작하며 반드시 한 줄로 작성.
7. 하나의 • 항목에 하나의 포인트만 담을 것. 관련된 부가 설명(수일치, 수식 범위 등)은 줄을 나누지 말고 슬래시(/)로 이어서 한 줄에 작성.
8. 불필요한 문장 추가 금지.
9. 해석 작성 금지.
10. 번호 매기지 말 것.

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
• 주격 관계대명사 who가 선행사 few of us를 수식함 / 선행사가 복수 취급이므로 관계절 동사 don't가 복수형으로 수일치함.

문장: The switch happens by sending emails or clicking buttons.
출력:
• 전치사 by 뒤에 동명사가 와서 수단을 나타냄 / sending과 clicking이 or로 병렬 연결됨.

문장: This means a careful act may be required.
출력:
• 동사 means의 목적어로 that이 생략된 명사절이 옴.
• 조동사 may + be p.p. 형태의 수동태임.`;

    const hintSystemPrompt = `너는 한국 고등학교 수능 대비 영어 구문분석 교재를 제작하는 전문 강사다.
사용자가 전체 문장과 그 안에서 특정 구문을 선택하고, 분석할 문법 포인트를 힌트로 제시했다.

[핵심 지시]
1. 전체 문장의 맥락을 먼저 파악한 뒤, 사용자가 지정한 포인트가 해당 문장에서 어떤 역할을 하는지 구체적으로 설명하라.
2. 단순히 문법 용어를 나열하지 말고, 그 문장에서 실제로 어떻게 쓰였는지를 기능 중심으로 서술하라.
3. 사용자가 언급하지 않은 문법 포인트는 절대 추가하지 말 것.

[절대 규칙]
1. 각 항목은 • 로 시작, 반드시 한 줄로 작성.
2. 하나의 • 항목에 하나의 포인트만 담을 것. 관련된 부가 설명(수일치, 수식 범위 등)은 줄을 나누지 말고 슬래시(/)로 이어서 한 줄에 작성.
3. 해석/정의 설명 금지. 기능 중심으로만 설명.
4. 출력에 큰따옴표(" ")를 절대 사용하지 말 것.
5. 3단어 이상의 영어 구문은 첫단어~마지막단어 형태로 축약하라. (예: who received the scholarship → who~scholarship)

[출력 말투 템플릿 – 반드시 이 스타일 유지]
- 주격 관계대명사 who가 선행사 students를 수식하는 형용사절을 이끌며, who~scholarship 전체가 students를 후치수식함 / 선행사 students가 복수이므로 관계절 동사 were가 복수형으로 수일치함.
- 가주어 it, 진주어 to-v 구문으로 to-v가 문장의 실제 주어 역할을 함.
- 5형식 동사 make + O + O.C 구조로, 목적어 them을 O.C가 보충 설명함.
- to부정사 to improve가 목적의 부사적 용법으로 쓰여 행위의 목적을 나타냄.
- 전치사 by 뒤에 동명사 using이 와서 수단/방법을 나타냄.
- 조동사 can + be p.p. 형태로 수동의 의미를 나타냄.
- 삽입된 부사구 in~sense는 문장 전체를 수식함.
- 병렬 구조로 reading과 writing이 and로 연결됨.
- 접속사 because가 이유의 부사절을 이끌어 주절의 원인을 나타냄.`;

    const systemPrompt = userHint ? hintSystemPrompt : baseSystemPrompt;
    const userMessage = userHint
      ? `전체 문장: ${sentence}\n선택 구문: ${textToAnalyze}\n힌트: ${userHint}`
      : `다음 문장을 구문분석하세요: ${textToAnalyze}`;

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
          { role: "user", content: userMessage },
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
