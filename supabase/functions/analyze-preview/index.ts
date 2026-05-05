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

// NOTE: 기존 SYSTEM_PROMPT(215줄)는 제거됨. 첫 생성(mode:"all")은 모듈 프롬프트 3개 병렬 호출로 처리.
// 모든 규칙은 PROMPT_INTRO / PROMPT_TOPIC_RULES / PROMPT_EXAM_SUMMARY_RULES /
// PROMPT_PASSAGE_SUMMARY_RULES / PROMPT_COMMON_RULES + topicExamplesByGrade(grade) 로 이식 완료.

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAi(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  opts?: { temperature?: number },
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
      temperature: opts?.temperature ?? 0.25,
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

function summaryHasOutOfRangeLine(summary: unknown, minLen = 45, maxLen = 58): boolean {
  if (typeof summary !== "string") return false;
  const lines = summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  return lines.some((line) => line.length < minLen || line.length > maxLen);
}

function topicVariantsIncomplete(parsed: any): boolean {
  const examBlock = parsed?.exam_block;
  if (!examBlock || typeof examBlock !== "object") return true;

  const basic = typeof examBlock.topic_basic === "string" ? examBlock.topic_basic.trim() : "";
  const basicKo = typeof examBlock.topic_basic_ko === "string" ? examBlock.topic_basic_ko.trim() : "";
  const advanced = typeof examBlock.topic_advanced === "string" ? examBlock.topic_advanced.trim() : "";
  const advancedKo = typeof examBlock.topic_advanced_ko === "string" ? examBlock.topic_advanced_ko.trim() : "";

  return !basic || !basicKo || !advanced || !advancedKo;
}

// ============================================================
// MODE-SPECIFIC PROMPT MODULES — 첫 생성/재생성 양쪽 다 사용
// ============================================================
// mode="all" = 아래 3개 모듈 모드(topic/exam_summary/passage_summary)를 병렬 호출 후 머지.
// → 첫 생성과 재생성이 100% 동일한 프롬프트를 사용. 톤 일관성 확보.
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
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.
- JSON 객체만 출력. 다른 텍스트 금지.`;

const PROMPT_TOPIC_RULES_G12 = `[topic 규칙]
- This MUST be written as a Korean mock-exam topic choice, NOT an explanation.
- Output a concise English noun phrase that functions as a multiple-choice answer.
- Use ONLY one central conceptual axis. Do NOT combine multiple ideas.

- Prefer standard exam structures:
  the role of ~ in ~
  the effect(s) of ~ on ~
  the influence of ~ on ~
  the importance of ~
  the necessity of ~
  the relationship between A and B
  the misconception about ~
  factors affecting ~

- Strongly AVOID explanatory constructions:
  construction of ~ due to ~
  formation of ~ from ~
  process of ~
  how ~ happens
  any "due to / because of / resulting from" chains

- Do NOT include:
  contrast tails such as despite, although, while, even though
  multiple clauses
  "and" connecting two ideas
  verbs as a full sentence structure
  a period at the end
  
- Invalid if the topic contains a finite verb such as is, are, has, have, does, makes, causes, ensures, shows, suggests, helps, uses, utilizes, creates, forms, changes.
- Invalid if the topic starts with "The human brain + verb", "People + verb", "Humans + verb", or "A/An/The + noun + verb".
- If a draft looks like "A does B by doing C", rewrite it as "the role/effect/influence of A in/on B".

- Length: 6~11 words ONLY.
- Style priority: clarity > abstraction; exam usability > completeness.
- If multiple elements exist, choose ONE and center the phrase around it.
- Rewrite aggressively into a clean test option.
- The output should look like a clean answer choice, not a summary or explanation.
- 위 규칙은 topic_basic 과 topic_advanced **두 변형 모두**에 적용된다. 절대 한 개만 출력하지 말 것.

[topic_basic_ko / topic_advanced_ko 규칙]
- 각 영문 변형의 한국어 번역.
- 자연스러운 한국어 명사구로 번역한다.
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.`;

const PROMPT_TOPIC_RULES_G3 = `[topic 규칙]
- This MUST be written as a Korean CSAT-style topic choice, NOT an explanation.
- Output a concise English noun phrase that functions as a multiple-choice answer.
- Use ONLY one central conceptual axis. Do NOT combine multiple ideas.

- Prefer evaluative or abstract head nouns:
  significance of ~
  consequence(s) of ~
  limitation(s) of ~
  implication(s) of ~
  recognition of ~
  interplay between A and B
  functional aspect(s) of ~
  outcome of ~
  effect of ~ on ~

- AVOID easy school-level frames unless the passage is genuinely simple:
  the role of ~ in ~
  the importance of ~
  the necessity of ~
  benefits of ~
  factors affecting ~

- Strongly AVOID explanatory constructions:
  construction of ~ due to ~
  formation of ~ from ~
  process of ~
  how ~ happens
  any "due to / because of / resulting from" chains

- Do NOT include:
  contrast tails such as despite, although, while, even though
  multiple clauses
  "and" connecting two ideas
  verbs as a full sentence structure
  a period at the end

- Invalid if the topic contains a finite verb such as is, are, has, have, does, makes, causes, ensures, shows, suggests, helps, uses, utilizes, creates, forms, changes.
- Invalid if the topic starts with "The human brain + verb", "People + verb", "Humans + verb", or "A/An/The + noun + verb".
- If a draft looks explanatory, causal, or too concrete, compress it into a more evaluative noun phrase.
- The output should feel more abstract, compressed, and concept-driven than a typical high-school-1/2 topic.

- Length: 6~11 words ONLY.
- Style priority: abstraction with clarity > exam usability > completeness.
- If multiple elements exist, choose ONE and center the phrase around it.
- Rewrite aggressively into a clean test option.
- The output should look like a clean answer choice, not a summary or explanation.
- 위 규칙은 topic_basic 과 topic_advanced **두 변형 모두**에 적용된다. 절대 한 개만 출력하지 말 것.

[topic_basic_ko / topic_advanced_ko 규칙]
- 각 영문 변형의 한국어 번역.
- 자연스러운 한국어 명사구로 번역한다.
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.`;

const PROMPT_TOPIC_VARIANT_RULES = `[topic variant rules]
- Generate TWO topic versions for the same passage: a basic version and an advanced version.
- Both versions must point to the SAME central topic and must remain valid answer choices for the passage.
- Both versions must be noun phrases, not sentences.
- The advanced version must NOT be a trivial synonym swap of the basic version.

[topic_basic rules]
- clearer, more direct, and immediately understandable.
- choose a more transparent noun phrase.
- easier to read than the advanced version, but still exam-style.

[topic_advanced rules]
- more compressed, more concept-driven, and more refined.
- should feel one step more advanced than the basic version within the same grade band.
- use a different head noun or framing when possible.

[topic_basic_ko / topic_advanced_ko rules]
- translate each English topic naturally into Korean noun phrases.
- keep the Korean aligned with its corresponding English version.`;

const PROMPT_EXAM_SUMMARY_RULES = `[one_sentence_summary 규칙]
- 반드시 한국어 한 문장으로 작성.
- 지문의 핵심 논리 관계(원인-결과, 대비, 양보, 문제-해결 등)가 드러나야 함.
- 구체 예시와 세부 사례는 제거하고 핵심 내용만 남길 것.
- 평가 방향이나 결론이 있으면 반드시 반영할 것.
- 학생이 바로 이해할 수 있는 자연스러운 한국어 문장으로 작성.
- 지나치게 추상적이거나 해설식 표현 금지.
- 정확히 한 문장만 출력. 여러 문장으로 나누지 말 것.
- 종결은 "~한다 / ~이다 / ~된다" 같은 평서문으로 마무리.
`;

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
- 지문에서 여러 이유나 요인이 제시되면 그중 핵심적인 하나 또는 공통된 방향을 반영할 것.
- 지문의 결론이 특정 평가나 판단을 포함하면 그 평가 방향을 ④ 문장에 반영할 것.
- 지문에서 특정 개념이 정의되면 그 정의를 ① 문장에 반영할 것.
- 지문이 사례나 사건을 설명하면 상황 → 대응 → 결과의 흐름을 반영할 것.
- 한국 중학생이 쉽게 이해할 수 있는 명확하고 간결한 한국어를 사용할 것.

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

const PROMPT_OUTPUT_TOPIC = `[필수 출력 스키마 — 위반 시 무효]
반드시 다음 4개 필드를 모두 포함할 것: topic_basic, topic_basic_ko, topic_advanced, topic_advanced_ko.
"topic" 또는 "topic_ko" 같은 단수 필드 출력은 금지(출력하면 무효).
네 필드 중 하나라도 비어 있으면 무효.

출력 형식 (JSON 객체만):
{"exam_block":{"topic_basic":"...","topic_basic_ko":"...","topic_advanced":"...","topic_advanced_ko":"..."}}`;

const PROMPT_OUTPUT_EXAM_SUMMARY = `출력 형식 (JSON 객체만):
{"exam_block":{"one_sentence_summary":"..."}}`;

const PROMPT_OUTPUT_PASSAGE_SUMMARY = `출력 형식 (JSON 객체만):
{"summary":"①...\\n②...\\n③...\\n④..."}`;

type Mode = "all" | "topic" | "exam_summary" | "passage_summary";
const VALID_MODES: Mode[] = ["all", "topic", "exam_summary", "passage_summary"];

type Grade = 1 | 2 | 3;

function gradePrefix(grade: Grade): string {
  if (grade === 3) {
    return `[Target Audience]
한국 고등학교 고3 대상.
수능 수준의 추상 어휘와 압축된 명사구 사용.
복잡한 논리 구조와 평가적 표현을 적극 반영.
이 기준은 다른 모든 스타일 규칙보다 우선한다.`;
  }

  // 🔥 고1 + 고2 통합
  return `[Target Audience]
한국 고등학교 고1~고2 대상.
내용이 드러나는 명사구 중심으로 작성.
과도한 추상화 금지, 직관적이고 이해 가능한 표현 사용.
이 기준은 다른 모든 스타일 규칙보다 우선한다.`;
}

function topicExamplesByGrade(grade: Grade): string {
  if (grade === 3) {
    return `[Sample Topic Answers — 고3 평가원/수능 스타일]
- significance of weighing forest resources’ non-market values
- outcome of music radio businesses’ attempts to attract large audiences
- consequences of profit-oriented management of museums
- implications of publicizing information for free choices
- limitations of using empirical observations in farming
- functional aspects of a paradigm in scientific research
- issues of allocating unfit tasks to humans in automated systems
- recognition of the social nature inherent in individuality
- effect of problem framing on approaching and solving problems
- complicated gene-environment interplay in moral development

[고3 topic 스타일]
- 더 압축적이고 추상적인 명사구를 사용한다.
- significance, consequence, limitation, effect, recognition, interplay, functional aspects 같은 평가적·개념적 명사를 적극 사용한다.
- 지문의 결론 방향을 드러내되, 완전한 문장으로 쓰지 않는다.`;
  }

  return `[Sample Topic Answers — 고1~고2 교육청 스타일]
- negative effect of fruit overconsumption on the cognitive brain
- necessity of using a common language to integrate the curriculum
- benefits of reduced domestic cooking duties through outsourcing
- persuasive power of peer behavior
- misconception about race as a biological construct
- people’s inclination towards unpredictability
- the role that sleep plays in the learning process
- benefits of utilizing sound and motion in warfare
- creativity as the realization of imagination
- human influence on the spread of invasive species

[고1~고2 topic 스타일]
- 내용이 분명히 보이는 반추상 명사구를 사용한다.
- effects, benefits, necessity, role, factors, influence, importance 같은 쉬운 학술 명사를 우선 사용한다.
- 고3처럼 지나치게 압축하거나 철학적으로 만들지 않는다.`;
}

function topicRulesByGrade(grade: Grade): string {
  return grade === 3 ? PROMPT_TOPIC_RULES_G3 : PROMPT_TOPIC_RULES_G12;
}

function initialTopicTemperatureByGrade(grade: Grade): number {
  return grade === 3 ? 0.5 : 0.3;
}

// 단일 영역 모드 전용 (topic | exam_summary | passage_summary).
// mode="all"은 더 이상 이 함수를 사용하지 않음 — 4개 모듈 모드 병렬 호출로 처리.
type SingleMode = Exclude<Mode, "all">;
function buildSystemPrompt(mode: SingleMode, grade: Grade): string {
  const prefix = gradePrefix(grade);
  let body: string;

  switch (mode) {
    case "topic":
      body = [
        PROMPT_INTRO,
        topicRulesByGrade(grade),
        PROMPT_TOPIC_VARIANT_RULES,
        PROMPT_COMMON_RULES,
        topicExamplesByGrade(grade),
        PROMPT_OUTPUT_TOPIC,
      ].join("\n\n");
      break;

    case "exam_summary":
      body = [PROMPT_INTRO, PROMPT_EXAM_SUMMARY_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_EXAM_SUMMARY].join("\n\n");
      break;

    case "passage_summary":
      body = [PROMPT_INTRO, PROMPT_PASSAGE_SUMMARY_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_PASSAGE_SUMMARY].join(
        "\n\n",
      );
      break;
  }

  return `${prefix}\n\n${body}`;
}

// ── topic 후처리 폴백: 4개 필드를 강제로 채움 ──
async function ensureTopicVariants(
  parsed: any,
  passage: string,
  grade: Grade,
  apiKey: string,
): Promise<any> {
  const eb = (parsed && typeof parsed === "object" ? parsed.exam_block : null) || {};

  // 옛 단수 스키마 → basic으로 승격
  if (!eb.topic_basic && typeof eb.topic === "string" && eb.topic.trim()) {
    eb.topic_basic = eb.topic.trim();
  }
  if (!eb.topic_basic_ko && typeof eb.topic_ko === "string" && eb.topic_ko.trim()) {
    eb.topic_basic_ko = eb.topic_ko.trim();
  }

  const basicEn = typeof eb.topic_basic === "string" ? eb.topic_basic.trim() : "";
  const basicKo = typeof eb.topic_basic_ko === "string" ? eb.topic_basic_ko.trim() : "";
  const advEn = typeof eb.topic_advanced === "string" ? eb.topic_advanced.trim() : "";
  const advKo = typeof eb.topic_advanced_ko === "string" ? eb.topic_advanced_ko.trim() : "";

  if (basicEn && basicKo && advEn && advKo) {
    return { ...parsed, exam_block: { ...eb, topic_basic: basicEn, topic_basic_ko: basicKo, topic_advanced: advEn, topic_advanced_ko: advKo } };
  }
  if (!basicEn) return parsed; // basic도 못 채우면 폴백 불가

  // advanced 전용 보강 호출
  try {
    const sysPrompt = `${gradePrefix(grade)}

${topicRulesByGrade(grade)}

[작업]
아래 지문에 대한 한국 수능형 topic 답안 중, 이미 정해진 basic 버전과 **다른 head noun / framing**을 사용한 advanced 버전 한 개만 생성하라.

[제약]
- basic과 동일한 중심 주제이되, 더 압축적·개념 중심·평가적 명사구.
- 단순 동의어 치환·어순 변경 금지.
- 6~11 단어 영문 명사구.
- 마침표 금지, 문장 금지.
- 한국어 번역도 자연스러운 명사구.

[출력 형식 — JSON 객체만, 다른 텍스트 금지]
{"topic_advanced":"...","topic_advanced_ko":"..."}`;

    const userPrompt = `[지문]
${passage}

[이미 정해진 basic]
- topic_basic: ${basicEn}
- topic_basic_ko: ${basicKo || "(없음 — 자유롭게 번역)"}`;

    const content = await callAi(
      apiKey,
      [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.6 },
    );
    const advParsed = safeParseJson(content);
    const newAdvEn = typeof advParsed?.topic_advanced === "string" ? advParsed.topic_advanced.trim() : "";
    const newAdvKo = typeof advParsed?.topic_advanced_ko === "string" ? advParsed.topic_advanced_ko.trim() : "";
    if (newAdvEn) eb.topic_advanced = newAdvEn;
    if (newAdvKo) eb.topic_advanced_ko = newAdvKo;
  } catch (err) {
    console.error("[analyze-preview:topic] advanced fallback failed:", err);
  }

  // 한국어가 비면 영문으로 폴백 (UI가 빈칸으로 보이는 것 방지)
  if (!eb.topic_basic_ko && eb.topic_basic) eb.topic_basic_ko = eb.topic_basic;
  if (!eb.topic_advanced_ko && eb.topic_advanced) eb.topic_advanced_ko = eb.topic_advanced;
  if (!eb.topic_advanced && eb.topic_basic) eb.topic_advanced = eb.topic_basic;

  return { ...parsed, exam_block: eb };
}

// ── 단일 모드 1회 호출 + (passage_summary 한정) length-retry 재시도까지 책임 ──
async function runSingleMode(
  mode: SingleMode,
  passage: string,
  grade: Grade,
  apiKey: string,
  opts?: { previous?: string; temperature?: number },
): Promise<any> {
  let systemPrompt = buildSystemPrompt(mode, grade);

  // 재생성 다양화: 직전 답을 회피 신호로 주입
  if (opts?.previous && opts.previous.trim()) {
    systemPrompt += `\n\n[재생성 지시]
- 직전에 제시한 답: "${opts.previous.trim()}"
- 위 답과 **다른 각도/관점/명사 선택**으로 작성할 것.
- 같은 핵심 명사·동일 표현의 단순 변형(어순만 바꾸기, 동의어 치환만 등) 금지.
- 단, 위의 모든 규칙(톤/형식/학년 난이도)은 그대로 준수할 것.`;
  }

  const content = await callAi(
    apiKey,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: passage },
    ],
    opts?.temperature !== undefined ? { temperature: opts.temperature } : undefined,
  );
  let parsed = safeParseJson(content);

  if (mode === "topic" && topicVariantsIncomplete(parsed)) {
    console.log("[analyze-preview:topic] incomplete topic variants, retrying");
    try {
      const retryContent = await callAi(apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: passage },
        { role: "assistant", content },
        {
          role: "user",
          content:
            "이전 응답은 topic_basic, topic_basic_ko, topic_advanced, topic_advanced_ko 중 일부가 비어 있거나 누락되었음(또는 단수 'topic'/'topic_ko' 필드로 답했음). 'topic'/'topic_ko' 같은 단수 필드 형태로 답하지 말 것. 반드시 네 필드(topic_basic, topic_basic_ko, topic_advanced, topic_advanced_ko)를 모두 채울 것. basic/advanced는 같은 중심 주제를 가리키되, advanced는 basic과 다른 head noun 또는 framing을 사용해야 함. 동일한 JSON 형식으로 exam_block 전체를 다시 출력할 것.",
        },
      ]);
      const retryParsed = safeParseJson(retryContent);
      if (!topicVariantsIncomplete(retryParsed)) {
        parsed = retryParsed;
      }
    } catch (retryErr) {
      console.error("[analyze-preview:topic] retry failed:", retryErr);
    }

    // 후처리 폴백: 모델이 여전히 옛 단수 스키마(topic/topic_ko)만 반환했거나
    // basic만 채워졌고 advanced가 비어 있으면 → basic으로 승격 + advanced 보강 호출.
    parsed = await ensureTopicVariants(parsed, passage, grade, apiKey);
  }

  // passage_summary만 줄 길이 재시도 적용 (45~58자 범위 강제)
  if (mode === "passage_summary" && summaryHasOutOfRangeLine(parsed?.summary)) {
    console.log(
      `[analyze-preview:${mode}] out-of-range line, retrying. lens:`,
      String(parsed?.summary)
        .split("\n")
        .map((l: string) => `${l.length}자`)
        .join(" / "),
    );
    try {
      const retryContent = await callAi(apiKey, [
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
      } else {
        const firstAvg = avgLineLen(parsed?.summary);
        const retryAvg = avgLineLen(retryParsed?.summary);
        if (Math.abs(retryAvg - 50) < Math.abs(firstAvg - 50)) parsed = retryParsed;
      }
    } catch (retryErr) {
      console.error(`[analyze-preview:${mode}] retry failed:`, retryErr);
    }
  }

  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage, mode: rawMode, grade: rawGrade, previous: rawPrevious } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const mode: Mode = (VALID_MODES as string[]).includes(rawMode) ? (rawMode as Mode) : "all";
    if (rawMode && !(VALID_MODES as string[]).includes(rawMode)) {
      console.warn(`[analyze-preview] invalid mode "${rawMode}", falling back to "all"`);
    }
    const grade: Grade = rawGrade === 1 || rawGrade === 2 || rawGrade === 3 ? rawGrade : 2;
    if (rawGrade !== undefined && grade !== rawGrade) {
      console.warn(`[analyze-preview] invalid grade "${rawGrade}", falling back to 2`);
    }
    console.log(`[analyze-preview] mode=${mode} grade=${grade}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ───────── 단일 영역 모드: 그대로 1회 호출 ─────────
    if (mode !== "all") {
      const prev = rawPrevious && typeof rawPrevious === "object"
        ? mode === "topic"
          ? [
              (rawPrevious as { topic_basic?: string }).topic_basic,
              (rawPrevious as { topic_advanced?: string }).topic_advanced,
            ]
              .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
              .join(" / ")
          : mode === "exam_summary"
              ? (rawPrevious as { one_sentence_summary?: string }).one_sentence_summary
              : undefined
        : undefined;
      const previous = typeof prev === "string" && prev.trim() ? prev.trim() : undefined;
      const temperature = previous ? 0.85 : undefined;
      try {
        const parsed = await runSingleMode(mode, passage, grade, LOVABLE_API_KEY, { previous, temperature });
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    }

    // ───────── mode="all": 3개 모듈 모드 병렬 호출 + 머지 ─────────
    // stagger 50ms 간격으로 발사해 rate-limit 압박 완화
    const stagger = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const launch = async (m: SingleMode, delay: number) => {
      if (delay) await stagger(delay);
      return runSingleMode(m, passage, grade, LOVABLE_API_KEY);
    };

    const [topicRes, examSumRes, passageSumRes] = await Promise.allSettled([
      runSingleMode("topic", passage, grade, LOVABLE_API_KEY, { temperature: initialTopicTemperatureByGrade(grade) }),
      launch("exam_summary", 50),
      launch("passage_summary", 100),
    ]);

    const pickExamBlock = (r: PromiseSettledResult<any>, label: string) => {
      if (r.status === "fulfilled") return r.value?.exam_block ?? {};
      console.error(`[analyze-preview] ${label} failed:`, r.reason);
      return {};
    };
    const pickSummary = (r: PromiseSettledResult<any>) => {
      if (r.status === "fulfilled") return r.value?.summary ?? "";
      console.error("[analyze-preview] passage_summary failed:", r.reason);
      return "";
    };

    const merged = {
      summary: pickSummary(passageSumRes),
      exam_block: {
        ...pickExamBlock(topicRes, "topic"),
        ...pickExamBlock(examSumRes, "exam_summary"),
      },
    };

    // 모든 영역이 실패한 극단적 케이스 → 429 우선, 아니면 500
    const allFailed =
      topicRes.status === "rejected" &&
      examSumRes.status === "rejected" &&
      passageSumRes.status === "rejected";
    if (allFailed) {
      const anyRateLimit = [topicRes, examSumRes, passageSumRes].some(
        (r) => r.status === "rejected" && (r.reason as { status?: number })?.status === 429,
      );
      return new Response(
        JSON.stringify({ error: anyRateLimit ? "Rate limit exceeded" : "All preview modes failed" }),
        { status: anyRateLimit ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(merged), {
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
  const lines = summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return 0;
  return lines.reduce((s, l) => s + l.length, 0) / lines.length;
}
