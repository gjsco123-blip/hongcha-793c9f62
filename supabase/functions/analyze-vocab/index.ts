import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseJson(raw: string): any {
  try { return JSON.parse(raw); } catch { /* fallback */ }
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
    try { return JSON.parse(cleaned); } catch { /* fallback */ }
  }
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1) {
    cleaned = cleaned.substring(objStart, objEnd + 1);
    try { return JSON.parse(`[${cleaned}]`); } catch { /* */ }
    try { const obj = JSON.parse(cleaned); return obj.vocab || [obj]; } catch { /* */ }
  }
  throw new Error("Failed to parse vocab JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage, count = 30, exclude_words = [], difficulty = "고등" } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = 너는 한국 ${difficulty} 학생용 영어 모의고사·내신 독해 어휘 추출 엔진이다.
"${difficulty}"이 "고등"일 경우, 고2 모의고사 평균 난이도로 간주한다.
목표는 '어려운 단어'가 아니라, 지문 이해와 출제(어휘/서술형)에 유용한 '개념어/논증 핵심어'를 우선해 뽑는 것이다.

너는 지금부터 아래 규칙을 엄격히 적용해 단어를 선택한다.

========================
[출력 형식 / 절대 규칙]
========================
- 반드시 JSON 배열만 출력. 다른 텍스트/설명/코드블록 금지.
- 정확히 ${count}개를 반드시 맞출 것.
- 각 항목은 다음 키만 포함:
  - word: 공백 없는 "단일 단어"만 (2단어 이상/복합명사/콜로케이션/숙어 금지)
  - pos: 동/명/형/부/접/전 중 하나만
  - meaning_ko: 짧은 직역(한국어)
  - in_context: 원문에서 연속된 2~6단어를 그대로 인용(반드시 word 포함)
- exclude_words에 포함된 단어는 절대 포함하지 말 것: [${exclude_words.join(", ")}]
- 기능어(a, the, is, are, of, to 등) 절대 포함 금지.
- 고유명사(인명/지명/기관명/국가/행성/연도 등) 절대 포함 금지.
- 같은 lemma(원형) 중복 금지(예: proves/proved → prove 1개만).

========================
[품사 표기 규칙]
========================
- 과거분사/현재분사가 명사를 수식하거나 보어로 쓰이면 pos는 반드시 '형'.
  (예: limited model → limited는 '형', not '동')
- 동사는 일반동사/기능동사를 피하고, 논증·학술 동사를 우선한다.

========================
[1차 하드 필터: 무조건 제외]
========================
아래에 해당하면 어떤 경우에도 뽑지 마라.
1) stopwords/기능어
2) 고유명사/약어/숫자/기호
3) 너무 범용적인 일반어(지문 이해에 기여 낮음) — 아래 리스트는 특히 제외:
   people, person, someone, something, anything, everything,
   thing, things, way, ways, world, life, idea, ideas, time,
   part, parts, kind, kinds, case, cases, point, points,
   reason, reasons, question, questions, problem, problems,
   same, very, most, some, only, also, just, even, well,
   make, made, get, got, take, took, give, gave, have, has, had,
   do, does, did, go, goes, went, come, came, put, set, show, keep, hold
4) "일반 동사 블랙리스트"(VERB이면 무조건 제외):
   be, have, make, take, get, come, go,
   see, say, give, find, know, think,
   use, keep, follow, hold, put, set, show

========================
[선정 기준: 클래스카드 유사 우선순위(점수 개념)]
========================
단어를 고를 때 아래 항목에 해당할수록 우선적으로 포함하라.

A. 추상 개념어(강력 우선)
- 아래 접미사로 끝나는 추상명사는 매우 우선:
  -tion, -sion, -ity, -ism, -ment, -ance, -ence, -ship, -sis
  예: justification, cognition, behaviorism, commitment, reliance, hypothesis 등

B. 논증/학술 핵심어(우선)
- 논증 구조를 잡아주는 단어(객관/증거/가설/비유/해석/한계/구별 등)를 우선:
  objective, evidence, proof, hypothesis, theory, metaphor, analogy,
  distinction, restrict, maintain, abandon, interpret, cognition, narrative,
  humanistic, anthropology, democracy, citizenship, suffrage, exclusionary,
  residence, veracity, plausible, justification, critical, reality, ultimate 등

C. 동사 선택은 더 엄격(클카 느낌)
- 동사는 아래 "논증/학술 동사"에 해당할 때만 적극 채택:
  interpret, restrict, confirm, disprove, maintain,
  recognize, reveal, reject, alter, influence,
  abandon, countenance, describe, incline, locate, prove
- 동사는 지문 주제/논증에 직접 기여하는 경우만 포함하고, 묘사·서사 동사는 웬만하면 제외.

D. 난이도 프리셋(고1/고2/고3)
- ${difficulty} 기준으로 '너무 전문적' 또는 '너무 쉬운' 단어 비율을 조절하라.
  - 고1: 지나치게 전문 학술어(생소한 학술 용어)는 줄이고, 독해 핵심어 중심(중상 난도)으로 구성
  - 고2: 개념어 비중을 늘리되, 너무 희귀 전문어는 제한
  - 고3: 추상 개념어/논증어/학술어 비중을 가장 높여도 됨

  [추가 정밀 규칙]
- 과거분사/현재분사가 동사에서 파생된 경우 가능한 한 원형 동사로 표기하라 (abandoned → abandon, permitting → permit).
  단, 다음은 원형으로 변환하지 않는다:
  · 전치사적 용법의 분사: concerning, regarding, considering, given, including, following 등
  · 고정 표현 속 분사: based (be based on), involved (be involved in), related (be related to) 등
- 범용 형용사(entire, common, local, general 등)는 지문 핵심 개념어가 아니면 제외하라.
- 동일 개념의 복수형은 하나만 남겨라 (resident/residents 중 하나).

========================
[최종 선택 체크리스트]
========================
- 결과 ${count}개를 "지문 이해에 도움 + 출제 가치" 기준으로 구성하라.
- 단어가 쉬운 편이라도, 논증 중심어면 포함 가능(예: objective, evidence).
- 너무 구체적인 사물명/예시 단어(예: wheel, birds 등)는 원칙적으로 제외하고 개념어를 우선.
- in_context는 원문에서 연속된 2~6단어 그대로이며, 반드시 word가 포함되어야 한다.

출력은 아래 형식으로만:
[{"word":"...","pos":"명","meaning_ko":"...","in_context":"..."} , ...]`;

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in response");

    const vocab = safeParseJson(content);

    return new Response(JSON.stringify({ vocab }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-vocab error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
