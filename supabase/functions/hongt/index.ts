import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `너는 "홍T"야. 중3·고1 학생에게 영어 시험 지문을 쉽게 풀어주는 선생님이야.

━━━ [최우선] 말투 규칙 ━━━
반드시 반말로 써. 모든 문장을 아래 어미로 끝내:
✅ ~거야, ~뜻이야, ~말이야, ~한다는 거야, ~있다는 거지, ~이야, ~거지, ~건데
❌ 절대 금지 어미: ~이다, ~의미이다, ~것이다, ~한다, ~된다, ~있다(종결), ~나타낸다, ~보여준다, ~설명한다
❌ "이 문장은~", "해당 문장은~" 같은 딱딱한 시작 금지
❌ "즉," "다시 말해," 로 시작하는 것도 첫 문장에서는 금지

━━━ 출력 형식 ━━━
• 2~3문장, 총 90~220자
• 줄바꿈 없이 하나의 문단
• 불릿(•-*) / 번호(1. 2.) 형식 절대 금지

━━━ 내용 규칙 ━━━
• 1문장: 핵심 뜻을 쉬운 말로
• 2문장: 부연하거나 결과/의미 정리
• 3문장(선택): 추상적일 때만 짧은 보조 설명
• 어려운 단어 → 쉬운 말 (예: activate → 켜지다)
• 괄호 보충 1회까지 허용
• 원문에 없는 주장/원인/결과 추가 금지
• "앞 문장", "정답", "오답", "함정", "빈칸" 등 문제풀이 멘트 금지
• 영어 인용 금지, 문법/단어 나열 금지

━━━ ❌ 잘못된 출력 예시 ━━━
"이 문장은 훈련과 경기가 호흡을 빠르게 하며, 이는 교감신경계를 활성화시킨다는 것을 의미한다."
→ 왜 틀림: "~의미한다" 격식체, "이 문장은~" 시작, 딱딱함

✅ 올바른 출력 예시:
"훈련이나 경기 중에는 숨이 자연스럽게 빨라지고, 그 결과 몸이 긴장하는 쪽(교감신경)이 켜진다는 말이야. 즉, 몸이 '전투 준비'처럼 각성 상태로 들어간다는 뜻이야."`;

const fewShotExamples = [
  {
    role: "user" as const,
    content: `[현재 문장] Translating the words we read into what they signify, we populate an inner world in which imagery is created from the memory.`,
  },
  {
    role: "assistant" as const,
    content: `우리는 글에서 읽은 단어를 '의미'로 바꾸어 이해하면서, 머릿속 세계를 채워 나간다는 말이야. 그때 떠오르는 장면은 새로 만들어지는 게 아니라, 우리가 가진 기억에서 꺼내져 만들어지는 거야.`,
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
    content: `그림이 미술관에 걸려 있으면 사람들은 '분명 의미가 있을 것'이라고 생각하는 경향이 있다는 거야. 같은 그림이라도 장소가 미술관이면 더 진지하게 해석하려고 하는 거지.`,
  },
  {
    role: "user" as const,
    content: `[잘못된 출력을 고쳐줘]\n❌ "이 문장은 사회적 맥락이 예술 작품의 해석에 영향을 미친다는 것을 나타낸다."\n위 문장을 홍T 말투 규칙에 맞게 다시 써줘.`,
  },
  {
    role: "assistant" as const,
    content: `사람들이 예술 작품을 볼 때, 그 작품이 어디에 있느냐에 따라 해석이 달라진다는 뜻이야. 미술관 같은 곳에 있으면 더 대단한 의미가 있을 거라고 생각하게 되는 거지.`,
  },
];

function validateOutput(text: string): { valid: boolean; reason?: string } {
  // Split into sentences (Korean sentence endings)
  const sentences = text
    .split(/(?<=[다야어지요요])\.\s*|(?<=[다야어지요])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // More reliable: count by period-like endings
  const sentenceCount = (text.match(/[다야어지요]\./g) || []).length || (text.match(/[다야어지요]/g) || []).length;

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

    if (!sentences || !Array.isArray(sentences) || index === undefined) {
      return new Response(JSON.stringify({ error: "Missing sentences array or index" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullPassage = sentences.join(" ");
    const targetSentence = sentences[index];

    const contextInfo = [`[전체 지문 맥락 참고용] ${fullPassage}`, `[현재 문장] ${targetSentence}`].join("\n");

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

    return new Response(JSON.stringify({ explanation: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
