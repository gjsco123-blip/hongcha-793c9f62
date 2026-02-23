import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `역할: 한국 중3·고1 학생을 위한 영어 지문 해설 선생님 "홍T".
목표: 시험 지문의 의미를 절대 벗어나지 않으면서, 중3·고1이 이해 가능한 2~3문장 쉬운설명을 생성한다.

■ 출력 형식 (강제)
- 반드시 2~3문장 (1문장만 또는 4문장 이상 금지)
- 총 글자수 90~220자 권장, 문장당 40~110자 권장
- 불릿(•, -, *) / 번호(1. 2.) 형식 절대 금지
- 줄바꿈 없이 하나의 문단으로 출력

■ 문장 구조
1문장: 핵심 뜻을 쉬운 말로
2문장: 핵심 개념을 다시 풀어주거나, 결과/의미를 쉬운 말로 정리
3문장(선택): 너무 추상적일 때만, 짧은 보조 설명 또는 예시 1개

■ 난이도 규칙
- 어려운 추상어 → 쉬운 말로 풀기 (예: "activate" → "켜지다", "metaphor" → "비유")
- 한자어/학술어 남발 금지
- 필요하면 짧은 괄호 설명 1회 허용 (예: "교감신경(몸을 긴장시키는 신경)")

■ 의미 보존 (시험 안전 모드)
- 원문에 없는 주장 추가 금지
- 원문에서 말하지 않은 원인/결과 생성 금지
- 필자 태도(비판/중립/강조) 바꾸지 않기
- 예시는 원문을 설명하는 보조로만, 1개까지(선택)

■ 절대 하지 말 것
- "앞 문장과 연결하면…" 같은 연결 설명
- "정답/오답/함정/빈칸" 등 문제풀이 멘트
- 문법/단어 정의 나열
- "이 문장은~" 같은 딱딱한 시작
- 영어 인용

■ 말투
- 반말 ("~거야", "~뜻이야", "~말이야")
- 친근하고 자연스럽게`;

const fewShotExamples = [
  {
    role: "user" as const,
    content: `[현재 문장] Translating the words we read into what they signify, we populate an inner world in which imagery is created from the memory.`,
  },
  {
    role: "assistant" as const,
    content: `우리는 글에서 읽은 단어를 '의미'로 바꾸어 이해하면서, 머릿속 세계를 채워 나간다는 말이야. 그때 떠오르는 장면은 새로 만들어지는 게 아니라, 우리가 가진 기억에서 꺼내져 만들어진다.`,
  },
  {
    role: "user" as const,
    content: `[현재 문장] Training and competition naturally speed the breath, which activates the sympathetic nervous system.`,
  },
  {
    role: "assistant" as const,
    content: `훈련이나 경기 중에는 숨이 자연스럽게 빨라지고, 그 결과 몸이 긴장하는 쪽(교감신경)이 켜진다는 말이야. 즉, 몸이 '전투 준비'처럼 각성 상태로 들어간다는 뜻이야.`,
  },
  {
    role: "user" as const,
    content: `[현재 문장] They tend to find meaning in it because it is located in a gallery.`,
  },
  {
    role: "assistant" as const,
    content: `그림이 미술관에 걸려 있으면 사람들은 '분명 의미가 있을 것'이라고 생각하는 경향이 있다는 말이야. 같은 그림이라도 장소가 미술관이면 더 진지하게 해석하려고 한다.`,
  },
];

function validateOutput(text: string): { valid: boolean; reason?: string } {
  // Split into sentences (Korean sentence endings)
  const sentences = text
    .split(/(?<=[다야어지요요])\.\s*|(?<=[다야어지요])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // More reliable: count by period-like endings
  const sentenceCount = (text.match(/[다야어지요]\./g) || []).length ||
    (text.match(/[다야어지요]/g) || []).length;

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
      model: "google/gemini-2.5-flash",
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

    if (!sentences || !Array.isArray(sentences) || index === undefined) {
      return new Response(JSON.stringify({ error: "Missing sentences array or index" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullPassage = sentences.join(" ");
    const targetSentence = sentences[index];

    const contextInfo = [
      `[전체 지문 맥락 참고용] ${fullPassage}`,
      `[현재 문장] ${targetSentence}`,
    ].join("\n");

    const userMessage = `다음 문장을 학생이 이해할 수 있도록 쉽게 설명해줘:\n\n${contextInfo}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...fewShotExamples,
      { role: "user", content: userMessage },
    ];

    // First attempt
    let content = await callAI(messages, LOVABLE_API_KEY);
    let validation = validateOutput(content);

    // Retry once if validation fails
    if (!validation.valid) {
      console.log(`HongT validation failed (${validation.reason}), retrying...`);
      const retryMessages = [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content: `위 결과가 규칙에 맞지 않아 (${validation.reason}). 반드시 2~3문장, 불릿/번호 없이, 연결 멘트 없이, 90~220자 내로 다시 작성해줘.`,
        },
      ];
      content = await callAI(retryMessages, LOVABLE_API_KEY);
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
