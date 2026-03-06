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

Your task is to generate:
[1] Core Thesis
[2] Best Title
[3] One-Sentence Summary

────────────────────
Step 1. Automatically Determine Difficulty Level (Do not show this analysis)
────────────────────
Evaluate the passage using the following criteria:
- Density of abstract nouns (e.g., necessity, implication, distinction, impact, role, perspective, interaction).
- Presence of evaluative language (e.g., problematic, misleading, crucial, inefficient).
- Use of contrast or concession structure (however, although, rather than, on the other hand).
- Presence of opposing viewpoints.
- Logical complexity (multi-step reasoning, critique, conditional argument).
If 3 or more apply → Treat as Grade 2+ level.
Otherwise → Treat as Grade 1 level.

────────────────────
Step 2. Internal Analysis (Do not show this analysis)
────────────────────
- Identify the central claim.
- Distinguish main reasoning from examples.
- Identify background/context information.
- Detect evaluative direction (positive, negative, critical, supportive).
- Determine the dominant logical structure (cause-effect, contrast, concession, problem-solution, general-specific).
- Determine which idea the conclusion ultimately supports.

────────────────────
Step 3. Adjust Abstraction Level Automatically
────────────────────
If Grade 1:
- Use moderate abstraction.
- Stay close to the explicitly stated main idea.
- Focus on central concept + effect or function.
- Keep the logical structure clear and direct.

If Grade 2+:
- Raise abstraction by one level.
- Clearly reflect evaluative stance.
- Explicitly preserve the dominant logical relationship.
- Use more conceptual phrasing where appropriate.

────────────────────
Step 4. Generate Output
────────────────────

Generate the following as a JSON object:

1. exam_block.topic (Core Thesis / 주제):
   - One sentence in English.
   - Must express a CLAIM (not just a topic description).
   - Broader than specific examples.
   - Preserve the direction of the conclusion. No exaggeration. No new concepts. Avoid vague "about ~" expressions.

2. exam_block.topic_ko: Korean translation of topic.

3. exam_block.title (Best Title / 제목):
   - Concise noun phrase in English, shorter and more compressed than the thesis.
   - Academic and clear (not poetic). Sentence case (only first word capitalized).
   - Question format allowed only if the passage clearly answers it.
   - Prefer structure: abstract noun + of + key concept
     (e.g., impact of ~, role of ~, necessity of ~, distinction between ~).
   - 5~9 words.

4. exam_block.title_ko: Korean translation of title.

5. exam_block.one_sentence_summary (One-Sentence Summary):
   - Exactly ONE sentence in English.
   - Must clearly reflect the dominant logical relationship
     (cause-effect, contrast, concession, problem-solution, etc.).
   - Remove specific examples and detailed cases.
   - Preserve evaluative direction if present.
   - Suitable for Korean mock-exam summary style.
   - Abstract but not overly philosophical.
   - Do NOT split into multiple sentences.

6. exam_block.one_sentence_summary_ko: Korean translation of one_sentence_summary.

7. summary (Passage Logic / 지문 논리):
   - 반드시 정확히 4문장, 줄바꿈 \\n으로 구분, 한국어로 작성.
   - 각 문장 앞에 번호를 붙일 것: ① ② ③ ④
   - ① 지문의 핵심 주장 또는 중심 아이디어를 진술.
   - ② 그 아이디어를 뒷받침하는 핵심 이유나 메커니즘을 설명.
   - ③ 지문에 나오는 중요한 예시, 개념, 또는 설명을 간략히 제시.
   - ④ 최종 결론 또는 저자의 핵심 메시지를 진술.
   - 원문의 표현과 논리에 충실할 것. 원문에 명시되지 않은 정보를 추가하지 말 것.
   - 배경 정보보다 핵심 논증에 집중할 것.
   - 대비 구조(A but B)가 있으면 반영할 것.
   - 지문에서 여러 이유나 요인이 제시되면 그 중 핵심적인 하나 또는 공통된 방향을 요약에 반영할 것.
   - 지문의 결론이 특정 평가나 판단을 포함하면 그 평가 방향을 ④ 문장에 반영할 것.
   - 지문의 첫 문장은 단순 배경 설명일 수 있으므로 그대로 반복하지 말고 중심 주장으로 요약할 것.
   - 지문에서 특정 개념이 정의되면 그 정의를 ① 문장에 반영할 것.
   - 지문이 사례나 사건을 설명하면 상황 → 대응 → 결과의 흐름을 반영할 것.
   - 한국 중학생이 쉽게 이해할 수 있는 명확하고 간결한 한국어를 사용할 것.

────────────────────
Critical Korean Exam Rules
────────────────────
- Do not reverse cause and effect.
- Do not narrow the scope to a single example.
- Do not overgeneralize beyond the passage.
- Do not introduce concepts not central to the text.
- Do not merely restate the first sentence.
- Focus on the overall argumentative direction.

────────────────────
절대 규칙
────────────────────
- JSON 객체만 출력. 다른 텍스트 금지.
- summary는 반드시 \\n으로 구분된 4줄이어야 한다 (①②③④).
- 의미 왜곡 금지: 원문에 없는 주장, 평가, 비판, 예측을 추가하지 말 것.

출력 형식:
{"summary":"①...\\n②...\\n③...\\n④...","exam_block":{"topic":"...","topic_ko":"...","title":"...","title_ko":"...","one_sentence_summary":"...","one_sentence_summary_ko":"..."}}`;

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
