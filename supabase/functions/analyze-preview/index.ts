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

const SYSTEM_PROMPT = `[CRITICAL LENGTH RULE — 최우선 규칙]
summary의 각 줄(①②③④)은 반드시 한국어 48~55자 (공백·번호·구두점 포함). 허용 범위는 45~58자.
- 45자 미만 = 무효. 58자 초과 = 무효. 출력 금지.
- 출력 직전 각 줄 글자수를 직접 세어 검증할 것.
- 짧으면 [주체] + [원인/메커니즘] + [결과/결론 방향] 3요소 중 누락된 것을 추가해 늘릴 것.
- 길이를 맞추는 방식은 "압축"이 아니라 "정보 추가". 추상어를 더 끼워넣지 말고 구체 개념·주체·메커니즘을 명시할 것.
- "간결하게"라는 본능을 누르고 정보를 채워 넣을 것.
이 규칙은 다른 모든 스타일 규칙보다 우선한다.

You are a Korean high school English exam specialist AND a preview engine for Korean high school reading comprehension passages.

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

6. exam_block.one_sentence_summary_ko (한글 직역):
   - 영문 one_sentence_summary의 직역(literal translation).
   - 영문 어순·구조·핵심 명사를 최대한 보존할 것.
   - 영문 단어가 한글에서 1:1로 추적 가능해야 함 (학생이 영문↔한글 짝지어 읽기 가능).
   - 영문에 없는 부연·예시·평가어 추가 금지.
   - 핵심 명사는 그대로 옮길 것 (예: "long-term decision-making" → "장기적 의사결정").
   - 자연스러운 한국어 어순 조정은 허용하나, 의미 단위(주어/동사/목적어/수식구) 순서를 임의로 뒤집지 말 것.
   - 종결: "~한다 / ~이다 / ~된다" 평서문 동사 종결 (명사형 종결 금지).
   - 한자어 금지, 한글만.
   - 금지어: "~을 시사한다 / ~을 의미한다 / ~라고 볼 수 있다" 같은 해설성 표현 (영문에 그런 표현이 있을 때만 허용).

   예시:
   영문: "Immediate rewards systematically distort long-term decision-making by exploiting evolutionary biases in the human brain."
   Good: "즉각적 보상은 인간 두뇌의 진화적 편향을 이용해 장기적 의사결정을 체계적으로 왜곡한다."
   Bad: "사람들은 당장의 만족 때문에 미래를 제대로 못 본다는 점이 문제다."

7. summary (Passage Logic / 지문 논리):
   - 반드시 정확히 4개 항목, 줄바꿈 \\n으로 구분, 한국어로 작성.
   - 각 항목 앞에 번호를 붙일 것: ① ② ③ ④
   - **각 항목은 정확히 한 줄(single line)** — 항목 내부에 \\n, 줄바꿈, 또는 줄을 나누는 어떠한 문자도 절대 포함 금지.
   - **각 줄 길이는 한국어 기준 45~58자** (번호·공백·구두점 포함).
     - 40자 미만이면 무효. 핵심 정보(주체/원인/결과/조건)를 추가해 50자 안팎으로 늘릴 것.
     - 60자를 초과하면 부수적 수식어를 제거해 길이를 줄일 것.
   - 정보 밀도는 기존보다 소폭(+10~20%) 높이되, 추상어 나열은 금지. 원인/결과·주체·결론 중 핵심 요소를 각 줄에 분명히 포함할 것.
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
모범 예시 (Few-shot — 길이/밀도 감각용)
────────────────────
Good #1 (각 줄 정확히 48~55자, 한 줄 고정, 명사형 종결):
① 즉각적 보상을 선호하는 인간 두뇌의 진화적 편향이 장기적 의사결정을 왜곡시키는 경향성
② 현재 가치를 과대평가하도록 설계된 두뇌 회로가 미래 이익을 체계적으로 평가절하하는 메커니즘
③ 마시멜로 실험에서 만족을 지연한 아동들이 학업·사회성 면에서 더 우수했다는 연구 결과
④ 보상 즉각성이 합리적 판단을 구조적으로 왜곡한다는 점을 경계해야 한다는 저자의 비판적 결론

Good #2 (각 줄 정확히 48~55자, 정보 밀도 충분):
① 외부 보상에 의존한 동기 부여가 활동 자체에 대한 내재적 흥미를 점진적으로 약화시키는 구조
② 보상이 주어질 때 학습자가 활동의 즐거움보다 결과에만 집중하게 되는 심리적 전환 메커니즘
③ 독서에 금전적 보상을 제공한 학생들이 보상 종료 후 오히려 독서 빈도가 감소한 실험 사례
④ 외적 보상의 무분별한 사용이 자율성과 흥미를 훼손할 수 있다는 저자의 핵심적 경고 메시지

Bad (40자대 — 정보 부족, 절대 금지):
① 즉각적 보상이 장기적 이익보다 우선시되는 의사결정 경향  ← 약 30자, 무효 (너무 짧음)
② 인간 두뇌가 현재 가치를 과대평가하도록 진화한 메커니즘  ← 약 30자, 무효 (너무 짧음)
③ 외부적 보상이 단기 동기 부여에 미치는 한계  ← 약 24자, 무효
④ 인센티브와 처벌이 초래하는 비용과 스트레스  ← 약 22자, 무효
→ 위 길이는 모두 무효. 반드시 [주체] + [원인/메커니즘] + [결과/결론 방향]
   3요소 중 최소 2개를 명시해 48~55자로 만들 것.

[줄 길이 강제 — 다시 강조]
- 각 줄은 반드시 한국어 48~55자(공백·번호 포함). 45자 미만 또는 58자 초과 모두 무효.
- 출력 직전 ①②③④ 각 줄 글자수를 정확히 세어 검증할 것.
- 짧으면 [주체/원인/결과] 중 누락된 요소를 추가해 늘릴 것 — "압축"이 아니라 "정보 추가"로 길이를 맞출 것.

Bad (한 항목이 줄바꿈 — 절대 금지):
② 인간 두뇌가 현재 가치를\\n과대평가하는 메커니즘

────────────────────
종결 스타일 (summary 전용)
────────────────────
- 모든 문장은 반드시 명사형으로 마무리할 것.
- 허용 패턴: ~라는 점, ~하는 구조, ~하는 흐름, ~라는 전제, ~경향, ~라는 의미, ~하는 방식, ~필요성, ~중요성, ~라는 주장
- 금지 패턴: ~한다, ~된다, ~이다, ~있다, ~했다, ~합니다, ~됩니다, ~임, ~함
- Good: "① 보상의 즉각성이 합리적 의사결정을 구조적으로 왜곡한다는 점을 드러내는 영향"
- Good: "② 즉각적 보상이 장기적 이익보다 우선시되는 인간 두뇌의 진화적 편향 경향"
- Bad: "① 보상의 즉각성이 의사결정에 영향을 미친다" (너무 짧고 동사 종결)
- Bad: "② 즉각적 보상이 장기적 이익보다 선호됨" (음슴체 금지)

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
[OUTPUT SELF-CHECK]
────────────────────
출력 직전, summary의 각 줄 글자수(공백·번호 포함)를 세어
45~58자 범위인지 확인할 것.
범위 밖(특히 40자 미만)이면 다시 작성한 후 출력할 것.

────────────────────
절대 규칙
────────────────────
- JSON 객체만 출력. 다른 텍스트 금지.
- summary는 반드시 \\n으로 구분된 4줄이어야 한다 (①②③④).
- summary 각 항목 내부에는 \\n, 줄바꿈, 또는 줄을 나누는 어떠한 문자도 절대 포함 금지. 4개 항목 사이의 \\n만 허용.
- summary 각 줄 길이는 한국어 기준 45~58자 범위 강제 (번호·공백·구두점 포함).
- 40자 미만은 절대 금지.
- 의미 왜곡 금지: 원문에 없는 주장, 평가, 비판, 예측을 추가하지 말 것.

출력 형식:
{"summary":"①...\\n②...\\n③...\\n④...","exam_block":{"topic":"...","topic_ko":"...","title":"...","title_ko":"...","one_sentence_summary":"...","one_sentence_summary_ko":"..."}}`;

const SELF_CRITIQUE_PROMPT = `다음 체크리스트로 이전 응답을 평가하고, 하나라도 미달이면 수정 후 동일 JSON으로 다시 출력할 것.

[Passage Logic 체크리스트]
1. ①②③④ 각 줄 글자수가 한국어 45~58자(공백·번호 포함)인가?
   → 짧으면 [주체]+[원인/메커니즘]+[결과/결론] 3요소 중 누락된 것을 추가해 늘릴 것.
2. 각 줄이 명사형 종결(~점/구조/경향/방식 등)인가? 동사 종결·음슴체 금지.
3. 원문의 논리 구조(대비/인과/양보/문제해결)가 ④번 결론 줄에 정확히 반영됐는가?
4. 원문에 없는 평가·주장·예측이 추가되지 않았는가?

[exam_block 체크리스트]
5. topic이 단순 설명이 아니라 명확한 CLAIM(주장)인가?
6. title이 5~9 단어 명사구(abstract noun + of + key concept 권장)인가?
7. one_sentence_summary가 정확히 한 문장이며 논리 구조를 반영하는가?
8. one_sentence_summary_ko가 영문의 직역인가?
   - 영문의 핵심 명사·동사가 한글에서 1:1 추적 가능한가?
   - 영문에 없는 해설·평가·예시가 추가되지 않았는가?
   - "~을 시사한다 / ~라고 볼 수 있다" 같은 임의 해설어가 들어가지 않았는가?
   미달이면 직역 원칙으로 다시 작성할 것.

평가 결과 모든 항목 충족이면 1차 응답을 그대로 다시 출력.
하나라도 미달이면 수정한 결과를 동일 JSON 형식으로 출력.
JSON 객체 외 다른 텍스트 출력 금지.`;

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAi(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
) {
  const response = await fetch(LOVABLE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      temperature: 0.25,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    const err = new Error(`AI error: ${response.status}`) as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in response");
  return content as string;
}

function summaryHasOutOfRangeLine(
  summary: unknown,
  minLen = 45,
  maxLen = 58,
): boolean {
  if (typeof summary !== "string") return false;
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  return lines.some((line) => line.length < minLen || line.length > maxLen);
}

// ============================================================
// MODE-SPECIFIC PROMPT MODULES (재생성 전용 — 첫 생성은 SYSTEM_PROMPT 사용)
// ============================================================
// 첫 생성(mode:"all")은 위의 기존 SYSTEM_PROMPT를 그대로 씀 → 회귀 위험 0.
// 아래 모듈은 개별 필드 재생성 시에만 사용.

const PROMPT_INTRO = `You are a Korean high school English exam specialist for reading comprehension passages.
I will provide an English passage. Internally analyze:
- Difficulty (abstract noun density, evaluative language, contrast/concession, opposing views, logical complexity).
- Central claim, main reasoning vs examples, background, evaluative direction (positive/negative/critical/supportive).
- Dominant logical structure (cause-effect, contrast, concession, problem-solution, general-specific).
- Conclusion direction.
Do NOT show this analysis. Use it only to inform the output.`;

const PROMPT_COMMON_RULES = `[Critical Korean Exam Rules]
- Do not reverse cause and effect.
- Do not narrow scope to a single example.
- Do not overgeneralize beyond the passage.
- Do not introduce concepts not central to the text.
- Do not merely restate the first sentence.
- Focus on the overall argumentative direction.
- 한자어 금지, 한글만. JSON 객체만 출력. 다른 텍스트 금지.`;

const PROMPT_TOPIC_RULES = `[Sample Correct Answers — topic의 추상화 수준/톤/구조 참고]
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

[topic 규칙]
- One sentence in English.
- Must express a CLAIM (not just a topic description).
- Broader than specific examples.
- Preserve the direction of the conclusion. No exaggeration. No new concepts.
- Avoid vague "about ~" expressions.

[topic_ko 규칙]
- topic의 한국어 번역.
- 자연스러운 한국어 명사구. 한자어 금지, 한글만.`;

const PROMPT_TITLE_RULES = `[title 규칙]
- Concise noun phrase in English, shorter and more compressed than the thesis.
- Academic and clear (not poetic). Sentence case (only first word capitalized).
- Question format allowed only if the passage clearly answers it.
- Prefer structure: abstract noun + of + key concept (e.g., impact of ~, role of ~, necessity of ~, distinction between ~).
- 5~9 words.

[title_ko 규칙]
- title의 한국어 번역.
- 자연스러운 한국어 명사구. 한자어 금지, 한글만.`;

const PROMPT_EXAM_SUMMARY_RULES = `[one_sentence_summary 규칙]
- Exactly ONE sentence in English.
- Must clearly reflect the dominant logical relationship (cause-effect, contrast, concession, problem-solution, etc.).
- Remove specific examples and detailed cases.
- Preserve evaluative direction if present.
- Suitable for Korean mock-exam summary style.
- Abstract but not overly philosophical.
- Do NOT split into multiple sentences.

[one_sentence_summary_ko 규칙 — 직역(literal translation)]
- 영문 어순·구조·핵심 명사를 최대한 보존할 것.
- 영문 단어가 한글에서 1:1로 추적 가능해야 함.
- 영문에 없는 부연·예시·평가어 추가 금지.
- 핵심 명사는 그대로 옮길 것 (예: "long-term decision-making" → "장기적 의사결정").
- 자연스러운 한국어 어순 조정은 허용하나, 의미 단위 순서를 임의로 뒤집지 말 것.
- 종결: "~한다 / ~이다 / ~된다" 평서문 동사 종결 (명사형 종결 금지).
- 한자어 금지, 한글만.
- 금지어: "~을 시사한다 / ~을 의미한다 / ~라고 볼 수 있다" 같은 해설성 표현 (영문에 그런 표현이 있을 때만 허용).

예시:
영문: "Immediate rewards systematically distort long-term decision-making by exploiting evolutionary biases in the human brain."
Good: "즉각적 보상은 인간 두뇌의 진화적 편향을 이용해 장기적 의사결정을 체계적으로 왜곡한다."
Bad: "사람들은 당장의 만족 때문에 미래를 제대로 못 본다는 점이 문제다."`;

const PROMPT_PASSAGE_SUMMARY_RULES = `[CRITICAL LENGTH RULE — 최우선]
summary의 각 줄(①②③④)은 반드시 한국어 48~55자 (공백·번호·구두점 포함). 허용 범위는 45~58자.
- 45자 미만 = 무효. 58자 초과 = 무효. 출력 금지.
- 출력 직전 각 줄 글자수를 직접 세어 검증할 것.
- 짧으면 [주체] + [원인/메커니즘] + [결과/결론 방향] 3요소 중 누락된 것을 추가해 늘릴 것.
- 길이를 맞추는 방식은 "압축"이 아니라 "정보 추가". 추상어를 더 끼워넣지 말고 구체 개념·주체·메커니즘을 명시할 것.

[summary 규칙 — Passage Logic]
- 반드시 정확히 4개 항목, 줄바꿈 \\n으로 구분, 한국어로 작성.
- 각 항목 앞에 번호: ① ② ③ ④
- **각 항목은 정확히 한 줄(single line)** — 항목 내부에 \\n 절대 포함 금지.
- ① 지문의 핵심 주장 또는 중심 아이디어를 진술.
- ② 그 아이디어를 뒷받침하는 핵심 이유나 메커니즘을 설명.
- ③ 지문에 나오는 중요한 예시, 개념, 또는 설명을 간략히 제시.
- ④ 최종 결론 또는 저자의 핵심 메시지를 진술.
- 원문에 명시되지 않은 정보 추가 금지. 배경보다 핵심 논증에 집중.
- 대비 구조(A but B) 반영. 결론의 평가 방향을 ④에 반영.
- 첫 문장이 단순 배경이면 그대로 반복하지 말 것.

[종결 스타일 — 명사형만 허용]
- 허용: ~라는 점, ~하는 구조, ~하는 흐름, ~라는 전제, ~경향, ~라는 의미, ~하는 방식, ~필요성, ~중요성, ~라는 주장
- 금지: ~한다, ~된다, ~이다, ~있다, ~했다, ~합니다, ~됩니다, ~임, ~함

[모범 예시 — Few-shot]
Good (각 줄 48~55자):
① 즉각적 보상을 선호하는 인간 두뇌의 진화적 편향이 장기적 의사결정을 왜곡시키는 경향성
② 현재 가치를 과대평가하도록 설계된 두뇌 회로가 미래 이익을 체계적으로 평가절하하는 메커니즘
③ 마시멜로 실험에서 만족을 지연한 아동들이 학업·사회성 면에서 더 우수했다는 연구 결과
④ 보상 즉각성이 합리적 판단을 구조적으로 왜곡한다는 점을 경계해야 한다는 저자의 비판적 결론

Bad (40자대 금지): "① 즉각적 보상이 장기적 이익보다 우선시되는 의사결정 경향" ← 너무 짧음, 무효.

[OUTPUT SELF-CHECK]
출력 직전, 각 줄 글자수(공백·번호 포함)를 세어 45~58자 범위인지 확인. 범위 밖이면 다시 작성 후 출력.`;

const PROMPT_OUTPUT_TOPIC = `출력 형식 (JSON 객체만):
{"exam_block":{"topic":"...","topic_ko":"..."}}`;

const PROMPT_OUTPUT_TITLE = `출력 형식 (JSON 객체만):
{"exam_block":{"title":"...","title_ko":"..."}}`;

const PROMPT_OUTPUT_EXAM_SUMMARY = `출력 형식 (JSON 객체만):
{"exam_block":{"one_sentence_summary":"...","one_sentence_summary_ko":"..."}}`;

const PROMPT_OUTPUT_PASSAGE_SUMMARY = `출력 형식 (JSON 객체만):
{"summary":"①...\\n②...\\n③...\\n④..."}`;

type Mode = "all" | "topic" | "title" | "exam_summary" | "passage_summary";
const VALID_MODES: Mode[] = ["all", "topic", "title", "exam_summary", "passage_summary"];

type Grade = 1 | 2 | 3;

function gradePrefix(grade: Grade): string {
  return `[Target Audience]
한국 고등학교 ${grade}학년 (고${grade}) 대상.
Calibrate vocabulary range, sentence complexity, and abstraction level accordingly.
- 고1: 기초 어휘, 단순한 문장 구조, 구체적 개념 위주.
- 고2: 중급 어휘, 복합 문장, 추상 개념 일부 허용.
- 고3: 수능 수준의 추상 어휘, 복잡한 논리 구조, 평가적 표현 적극 사용.
이 학년 기준은 다른 모든 스타일 규칙보다 우선해서 톤·난이도를 결정한다.`;
}

function buildSystemPrompt(mode: Mode, grade: Grade): string {
  const prefix = gradePrefix(grade);
  let body: string;
  switch (mode) {
    case "topic":
      body = [PROMPT_INTRO, PROMPT_TOPIC_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_TOPIC].join("\n\n");
      break;
    case "title":
      body = [PROMPT_INTRO, PROMPT_TITLE_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_TITLE].join("\n\n");
      break;
    case "exam_summary":
      body = [PROMPT_INTRO, PROMPT_EXAM_SUMMARY_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_EXAM_SUMMARY].join("\n\n");
      break;
    case "passage_summary":
      body = [PROMPT_INTRO, PROMPT_PASSAGE_SUMMARY_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_PASSAGE_SUMMARY].join("\n\n");
      break;
    case "all":
    default:
      body = SYSTEM_PROMPT; // 본문은 그대로 — 학년만 prepend
  }
  return `${prefix}\n\n${body}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage, mode: rawMode, grade: rawGrade } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const mode: Mode = (VALID_MODES as string[]).includes(rawMode) ? (rawMode as Mode) : "all";
    if (rawMode && !(VALID_MODES as string[]).includes(rawMode)) {
      console.warn(`[analyze-preview] invalid mode "${rawMode}", falling back to "all"`);
    }
    const grade: Grade = (rawGrade === 1 || rawGrade === 2 || rawGrade === 3) ? rawGrade : 2;
    if (rawGrade !== undefined && grade !== rawGrade) {
      console.warn(`[analyze-preview] invalid grade "${rawGrade}", falling back to 2`);
    }
    console.log(`[analyze-preview] mode=${mode} grade=${grade}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = buildSystemPrompt(mode, grade);

    // 1차 호출
    let content: string;
    try {
      content = await callAi(LOVABLE_API_KEY, [
        { role: "system", content: systemPrompt },
        { role: "user", content: passage },
      ]);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    // 2차 호출 (Self-Critique): mode="all"에서만 적용 — 단일 필드 모드는 비용/오염 방지를 위해 생략
    if (mode === "all") {
      try {
        const critiqueContent = await callAi(LOVABLE_API_KEY, [
          { role: "system", content: systemPrompt },
          { role: "user", content: passage },
          { role: "assistant", content },
          { role: "user", content: SELF_CRITIQUE_PROMPT },
        ]);
        const critiqueParsed = safeParseJson(critiqueContent);
        if (critiqueParsed?.summary && critiqueParsed?.exam_block) {
          content = critiqueContent;
          console.log("[analyze-preview] self-critique applied");
        } else {
          console.log("[analyze-preview] self-critique result invalid, using 1st response");
        }
      } catch (critiqueErr) {
        console.warn("[analyze-preview] self-critique failed, using 1st response:", critiqueErr);
      }
    }

    let parsed = safeParseJson(content);

    // 후처리 안전망: summary 줄 길이 검증 (45~58자) — "all" 또는 "passage_summary"에서만 적용
    const summaryEligibleForLengthCheck = mode === "all" || mode === "passage_summary";
    if (summaryEligibleForLengthCheck && summaryHasOutOfRangeLine(parsed?.summary)) {
      console.log(
        "[analyze-preview] out-of-range summary line detected (target 45~58), retrying once. lines:",
        String(parsed?.summary)
          .split("\n")
          .map((l: string) => `${l.length}자`)
          .join(" / "),
      );
      try {
        const retryContent = await callAi(LOVABLE_API_KEY, [
          { role: "system", content: systemPrompt },
          { role: "user", content: passage },
          { role: "assistant", content },
          {
            role: "user",
            content:
              "이전 응답의 summary 항목 중 일부가 목표 길이(한국어 48~55자) 범위를 벗어났음. 각 줄을 반드시 한국어 48~55자(공백·번호 포함)로 다시 작성할 것. 짧다면 [주체] + [원인/메커니즘] + [결과/결론 방향] 3요소 중 누락된 것을 추가해 늘릴 것 — 압축이 아니라 정보 추가로 길이를 맞출 것. 동일한 JSON 형식으로 모든 필드를 포함해 다시 출력할 것.",
          },
        ]);
        const retryParsed = safeParseJson(retryContent);
        if (!summaryHasOutOfRangeLine(retryParsed?.summary)) {
          parsed = retryParsed;
          console.log("[analyze-preview] retry succeeded (all lines in 45~58)");
        } else {
          // 재시도해도 범위 밖 → 둘 중 평균 길이가 50자에 더 가까운 쪽 채택
          const firstAvg = avgLineLen(parsed?.summary);
          const retryAvg = avgLineLen(retryParsed?.summary);
          const firstDist = Math.abs(firstAvg - 50);
          const retryDist = Math.abs(retryAvg - 50);
          if (retryDist < firstDist) parsed = retryParsed;
          console.log(
            `[analyze-preview] retry still out-of-range (first avg=${firstAvg}, retry avg=${retryAvg})`,
          );
        }
      } catch (retryErr) {
        console.error("[analyze-preview] retry failed:", retryErr);
        // 재시도 실패해도 1차 결과 반환
      }
    }

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

function avgLineLen(summary: unknown): number {
  if (typeof summary !== "string") return 0;
  const lines = summary.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 0;
  return lines.reduce((s, l) => s + l.length, 0) / lines.length;
}
