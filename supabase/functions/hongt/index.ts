import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `역할: 영어 지문의 개별 문장을 중3~고1 학생이 이해할 수 있도록 쉽게 설명하는 시스템 "홍T".

■ 핵심 원칙 (우선순위 순서)
1. 원문 의미 정확히 보존 (시험 안전성 최우선)
2. 학생 이해 중심 설명
3. 간결하고 안정된 구조

■ 설명 vs 번역 (가장 중요)
- 홍T는 번역 시스템이 아니라 의미 설명 시스템이다.
- 영어 문장을 그대로 한국어로 옮기는 번역 방식 금지.
- 문장의 의미와 의도를 이해하기 쉬운 설명으로 재구성한다.

예시:
번역(금지): "보너스와 승진은 사람들에게 동기를 부여할 수 있다."
설명(허용): "보너스나 승진 같은 보상을 주면 사람들이 더 열심히 일하려는 동기를 갖게 된다는 의미다."

■ 의미 보존 규칙 (시험 안전 모드)
- 현재 문장에 직접 나타난 정보만 기반으로 설명한다.
- 원문에 없는 원인 추가 금지
- 원문에 없는 결과 추가 금지
- 문맥 기반 추론 설명 생성 금지
- 필자의 태도 변경 금지
- 지문 전체 의미 기반 확장 해석 금지

■ 맥락 사용 규칙
- 앞뒤 문장은 연결어(however, therefore 등)와 지시어(this, that, such) 이해를 위한 참고용이다.
- 설명은 반드시 현재 문장 중심으로 작성한다.
- 지문 전체 기반 추론 설명 금지.

■ 설명 구조
- 1문장: 현재 문장의 핵심 의미 설명
- 2문장: 의미를 쉬운 말로 다시 풀거나 정리
- 3문장(선택): 문장이 추상적이거나, 핵심 개념 또는 비유 표현 설명이 필요한 경우에만 허용
- 최소 2문장, 최대 3문장 (1문장만 또는 4문장 이상 절대 금지)

■ 문장 중요도 감지 (내부 판단, 사용자에게 표시하지 않음)
- 일반 문장(단순 정보, 예시, 보조 설명): 기본 2문장 설명
- 핵심 문장(필자의 주장, 개념 정의, 결론, 중요한 전환): 조금 더 명확하게, 필요 시 3문장

■ 표현 방식
- 특정 표현을 강제 고정하지 않는다.
- 문맥에 따라 자연스럽고 이해하기 쉬운 표현을 선택한다.
- 사용 가능 예: ~라는 뜻이다, ~라는 의미다, 즉 ~라는 말이다, 다시 말해 ~라는 것이다, 쉽게 말해 ~
- 상황에 따라 자연스럽게 혼합 사용 가능

■ 품질 규칙
- 간결한 설명
- 반복 표현 최소화
- 핵심 의미 중심
- 설명 밀도는 문장마다 가능한 한 균일하게 유지

■ 비유 표현 처리
- 비유 표현이 등장할 경우 필요하면 비유의 의미를 간단히 설명할 수 있다.
- 비유 설명은 필요한 경우에만 간단히 제공한다.

■ 제한적 논리 힌트 허용
- 문장 이해에 필요한 경우 연결어 설명, 지시어 설명, 핵심 개념 간단 설명은 허용
- 논리 분석 형태 설명은 금지
- 설명 중심은 항상 문장 의미 이해

■ 난이도 규칙
- 어려운 추상어 → 쉬운 말로 풀기
- 한자어/학술어 남발 금지
- 필요하면 짧은 괄호 설명 1회 허용

■ 출력 형식 (강제)
- 2~3문장
- 불릿(•, -, *) / 번호(1. 2.) 형식 절대 금지
- 줄바꿈 없이 하나의 문단으로 출력
- 금지 표현: 정답, 오답, 함정, 빈칸, 선지, 앞 문장과 연결하면, 다음 문장과 연결하면
- "이 문장은~" 같은 딱딱한 시작 금지
- 영어 인용 금지`;

const fewShotExamples = [
  {
    role: "user" as const,
    content: `[현재 문장] Translating the words we read into what they signify, we populate an inner world in which imagery is created from the memory.`,
  },
  {
    role: "assistant" as const,
    content: `글에서 읽은 단어를 '의미'로 바꾸어 이해하면서 머릿속 세계를 채워 나간다는 뜻이다. 이때 떠오르는 장면은 새로 만들어지는 것이 아니라 우리가 가진 기억에서 꺼내져 구성된다는 의미다.`,
  },
  {
    role: "user" as const,
    content: `[현재 문장] Training and competition naturally speed the breath, which activates the sympathetic nervous system.`,
  },
  {
    role: "assistant" as const,
    content: `훈련이나 경기 중에는 숨이 자연스럽게 빨라지고, 그 결과 몸을 긴장시키는 교감신경이 활성화된다는 의미다. 즉 몸이 각성 상태로 전환된다는 뜻이다.`,
  },
  {
    role: "user" as const,
    content: `[현재 문장] We don't want to build a wall; we want to build a cathedral.`,
  },
  {
    role: "assistant" as const,
    content: `여기서 벽을 짓는다는 것은 단순한 일을 하는 것을 비유적으로 표현한 것이다. 반대로 성당을 짓는다는 것은 더 큰 의미와 목적을 가진 일을 하고 싶다는 뜻이다.`,
  },
];

function postProcess(text: string): string {
  return text
    .replace(/\n/g, " ")
    .replace(/^[\s]*[-•·*]\s*/gm, "")
    .replace(/^[\s]*\d+[.)]\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function validateOutput(text: string): { valid: boolean; reason?: string } {
  // Check bullet/number format
  if (/^[\s]*[-•·*]\s/m.test(text) || /^[\s]*\d+[.)]\s/m.test(text)) {
    return { valid: false, reason: "bullet_or_number" };
  }

  // Check connection phrases
  if (/앞\s*문장|다음\s*문장|앞에서|뒤에서|연결하면/.test(text)) {
    return { valid: false, reason: "connection_phrase" };
  }

  // Check test-solving phrases
  if (/정답|오답|함정|빈칸|선지/.test(text)) {
    return { valid: false, reason: "test_solving_phrase" };
  }

  // Length check
  if (text.length < 50) {
    return { valid: false, reason: "too_short" };
  }
  if (text.length > 350) {
    return { valid: false, reason: "too_long" };
  }

  // Sentence count by period (Korean endings + period)
  const periodCount = (text.match(/\./g) || []).length;
  if (periodCount < 2) {
    return { valid: false, reason: "too_few_sentences" };
  }
  if (periodCount > 3) {
    return { valid: false, reason: "too_many_sentences" };
  }

  return { valid: true };
}

async function callAI(messages: Array<{ role: string; content: string }>, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      temperature: 0.15,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded." };
    if (response.status === 402) throw { status: 402, message: "Credits exhausted." };
    throw new Error(`AI error: ${response.status}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentences, index } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Input validation
    if (!sentences || !Array.isArray(sentences)) {
      return new Response(JSON.stringify({ error: "sentences must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (index === undefined || !Number.isInteger(index) || index < 0 || index >= sentences.length) {
      return new Response(JSON.stringify({ error: "index must be a valid integer within sentences range" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sentences.every((s: unknown) => typeof s === "string")) {
      return new Response(JSON.stringify({ error: "All sentences must be strings" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3-sentence context window
    const prevSentence = index > 0 ? sentences[index - 1] : null;
    const currentSentence = sentences[index];
    const nextSentence = index < sentences.length - 1 ? sentences[index + 1] : null;

    const contextParts: string[] = [];
    if (prevSentence) contextParts.push(`[이전 문장 참고용] ${prevSentence}`);
    contextParts.push(`[현재 문장] ${currentSentence}`);
    if (nextSentence) contextParts.push(`[다음 문장 참고용] ${nextSentence}`);

    const userMessage = `다음 문장을 학생이 이해할 수 있도록 의미 중심으로 설명해줘:\n\n${contextParts.join("\n")}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...fewShotExamples,
      { role: "user", content: userMessage },
    ];

    // First attempt
    let content = await callAI(messages, LOVABLE_API_KEY);
    content = postProcess(content);
    let validation = validateOutput(content);

    // Retry once if validation fails
    if (!validation.valid) {
      console.log(`HongT validation failed (${validation.reason}), retrying...`);
      const retryMessages = [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content: `위 결과가 규칙에 맞지 않아 (${validation.reason}). 반드시 2~3문장, 불릿/번호 없이, 줄바꿈 없이 하나의 문단으로, 번역이 아닌 의미 설명으로 다시 작성해줘.`,
        },
      ];
      content = await callAI(retryMessages, LOVABLE_API_KEY);
      content = postProcess(content);
      // If still invalid, return post-processed result anyway (save credits)
    }

    return new Response(
      JSON.stringify({ explanation: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("hongt error:", e);
    const status = e.status || 500;
    const message = e.message || (e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
