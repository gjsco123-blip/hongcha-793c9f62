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

// NOTE: 기존 SYSTEM_PROMPT(215줄)는 제거됨. 첫 생성(mode:"all")은 모듈 프롬프트 4개 병렬 호출로 처리.
// 모든 규칙은 PROMPT_INTRO / PROMPT_TOPIC_RULES / PROMPT_TITLE_RULES / PROMPT_EXAM_SUMMARY_RULES /
// PROMPT_PASSAGE_SUMMARY_RULES / PROMPT_COMMON_RULES + topicExamplesByGrade(grade) 로 이식 완료.

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAi(apiKey: string, messages: Array<{ role: string; content: string }>) {
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

function summaryHasOutOfRangeLine(summary: unknown, minLen = 45, maxLen = 58): boolean {
  if (typeof summary !== "string") return false;
  const lines = summary
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
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
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.
- JSON 객체만 출력. 다른 텍스트 금지.`;

const PROMPT_TOPIC_RULES = `[topic 규칙]
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

[topic_ko 규칙]
- topic의 한국어 번역.
- 자연스러운 한국어 명사구로 번역한다.
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.`;

const PROMPT_TITLE_RULES = `[title 규칙]
- Concise noun phrase in English, shorter and more compressed than the thesis.
- Academic and clear (not poetic). Sentence case (only first word capitalized).
- Question format allowed only if the passage clearly answers it.
- Prefer structure: abstract noun + of + key concept (e.g., impact of ~, role of ~, necessity of ~, distinction between ~).
- 5~9 words.

[title_ko 규칙]
- title의 한국어 번역.
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.`;

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
- 불필요하게 어려운 한자어는 피하되, 고등학교 독해에서 흔히 쓰는 개념어는 허용한다.
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
- benefits of publicizing information to ensure free choices
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

// 단일 영역 모드 전용 (topic | title | exam_summary | passage_summary).
// mode="all"은 더 이상 이 함수를 사용하지 않음 — 4개 모듈 모드 병렬 호출로 처리.
type SingleMode = Exclude<Mode, "all">;
function buildSystemPrompt(mode: SingleMode, grade: Grade): string {
  const prefix = gradePrefix(grade);
  let body: string;

  switch (mode) {
    case "topic":
      body = [
        PROMPT_INTRO,
        topicExamplesByGrade(grade),
        PROMPT_TOPIC_RULES,
        PROMPT_COMMON_RULES,
        PROMPT_OUTPUT_TOPIC,
      ].join("\n\n");
      break;

    case "title":
      body = [PROMPT_INTRO, PROMPT_TITLE_RULES, PROMPT_COMMON_RULES, PROMPT_OUTPUT_TITLE].join("\n\n");
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

// ── 단일 모드 1회 호출 + (passage_summary 한정) length-retry 재시도까지 책임 ──
async function runSingleMode(
  mode: SingleMode,
  passage: string,
  grade: Grade,
  apiKey: string,
): Promise<any> {
  const systemPrompt = buildSystemPrompt(mode, grade);

  const content = await callAi(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: passage },
  ]);
  let parsed = safeParseJson(content);

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
    const { passage, mode: rawMode, grade: rawGrade } = await req.json();
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
      try {
        const parsed = await runSingleMode(mode, passage, grade, LOVABLE_API_KEY);
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

    // ───────── mode="all": 4개 모듈 모드 병렬 호출 + 머지 ─────────
    // stagger 50ms 간격으로 발사해 rate-limit 압박 완화
    const stagger = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const launch = async (m: SingleMode, delay: number) => {
      if (delay) await stagger(delay);
      return runSingleMode(m, passage, grade, LOVABLE_API_KEY);
    };

    const [topicRes, titleRes, examSumRes, passageSumRes] = await Promise.allSettled([
      launch("topic", 0),
      launch("title", 50),
      launch("exam_summary", 100),
      launch("passage_summary", 150),
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
        ...pickExamBlock(titleRes, "title"),
        ...pickExamBlock(examSumRes, "exam_summary"),
      },
    };

    // 모든 영역이 실패한 극단적 케이스 → 429 우선, 아니면 500
    const allFailed =
      topicRes.status === "rejected" &&
      titleRes.status === "rejected" &&
      examSumRes.status === "rejected" &&
      passageSumRes.status === "rejected";
    if (allFailed) {
      const anyRateLimit = [topicRes, titleRes, examSumRes, passageSumRes].some(
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
