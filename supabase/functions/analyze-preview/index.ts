import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    /* fallback */
  }
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1) {
    cleaned = cleaned.substring(objStart, objEnd + 1);
    try {
      return JSON.parse(cleaned);
    } catch {
      /* */
    }
  }
  throw new Error("Failed to parse preview JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a Korean high school English exam specialist AND a preview engine for Korean high school reading comprehension passages.

Below are sample correct answers from Korean mock exams.
Follow their abstraction level, tone, and structure.

[Sample Correct Answers]
1) cultural openness as a foundation for Rome's growth
2) need to act on scientific understanding in solving problems
3) importance of specific questions to attain reliable quantitative data
4) advantage of crop rotation in maintaining soil health
5) our common belief that we are better than average
6) Action Comes from Who You Think You Are
7) the necessity of various perspectives in practicing science
8) the impact of reward immediacy on decision-making
9) distinction between recall and familiarity in the memory system
10) counteraction of pleasure and pain in maintaining stability
11) views on whether science is free from cultural context or not
12) economic benefits of reduced domestic cooking duties through outsourcing

I will provide an English passage.

────────────────────
Step 1. Automatically Determine Difficulty Level (Do not show in output)
────────────────────
Evaluate based on:
- Density of abstract nouns (necessity, impact, distinction, role, perspective, etc.)
- Presence of evaluative language (problematic, misleading, crucial, etc.)
- Contrast/concession structure (however, although, rather than, etc.)
- Opposing viewpoints
- Logical complexity (multi-step or critical reasoning)
If 3+ apply → Treat as Grade 2+. Otherwise → Treat as Grade 1.

────────────────────
Step 2. Internal Analysis (Do not show in output)
────────────────────
- Identify central claim.
- Separate reasoning from examples.
- Detect evaluative direction.
- Determine dominant logical structure.
- Identify which idea the conclusion ultimately supports.

────────────────────
Step 3. Adjust Abstraction Level
────────────────────
If Grade 1: Moderate abstraction. Stay close to explicit main idea. Focus on central concept + function/effect. Keep structure simple.
If Grade 2+: Raise abstraction by one level. Reflect evaluative stance clearly. Preserve dominant logical relationship.

────────────────────
Step 4. Generate Output
────────────────────

Generate the following as a JSON object:

1. exam_block.topic (Core Thesis / 주제):
   - One sentence in English.
   - Express a CLAIM (not just topic). Broader than specific examples.
   - Preserve conclusion direction. No exaggeration. No new concepts. Avoid vague "about ~".

2. exam_block.topic_ko: Korean translation of topic.

3. exam_block.title (Best Title / 제목):
   - Concise noun phrase in English, shorter than thesis.
   - Academic tone (not poetic). Sentence case (only first word capitalized).
   - Question format allowed only if passage clearly answers it.
   - Prefer: abstract noun + of + key concept.
   - 5~9 words.

4. exam_block.title_ko: Korean translation of title.

5. exam_block.one_sentence_summary (Summary):
   - 2~3 sentences in English. Include central claim. Preserve dominant logical structure.
   - Remove detailed examples. Maintain formal academic tone.
   - 25~50 words total.

6. exam_block.one_sentence_summary_ko: Korean translation of one_sentence_summary.

7. summary (Key Summary / 핵심 요약):
   - 반드시 정확히 3문장, 줄바꿈 \\n으로 구분, 한국어로 작성.
   - 도식적 요약이 아니라, 학생이 자연스럽게 읽으면서 전체 논지를 이해할 수 있는 이야기형 요약.
   - 구조를 나열하지 말고, 갈등 또는 핵심 긴장 구조가 드러나게 하라.
   - 딱딱한 보고서체 금지 ("이는 ~이다", "따라서", "결론적으로" 금지)
   - 1문장: 글이 다루는 대상
   - 2문장: 어떻게 설명하는지 (전개 방식, 역설/갈등 구조 포함)
   - 3문장: 그래서 왜 중요한지 (의미/시사점)

────────────────────
Critical Korean Exam Rules
────────────────────
- Do not reverse cause-effect.
- Do not narrow scope to one example.
- Do not overgeneralize.
- Do not introduce non-central concepts.
- Do not simply restate the first sentence.
- Focus on overall argumentative direction.

────────────────────
절대 규칙
────────────────────
- JSON 객체만 출력. 다른 텍스트 금지.
- summary는 반드시 \\n으로 구분된 3줄이어야 한다.
- 의미 왜곡 금지: 원문에 없는 주장, 평가, 비판, 예측을 추가하지 말 것.

출력 형식:
{"summary":"1줄\\n2줄\\n3줄","exam_block":{"topic":"...","topic_ko":"...","title":"...","title_ko":"...","one_sentence_summary":"...","one_sentence_summary_ko":"..."}}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: passage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in response");

    const parsed = safeParseJson(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-preview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
