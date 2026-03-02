import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeParseJson(raw: string): any {
  try { return JSON.parse(raw); } catch { /* fallback */ }
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
    try { return JSON.parse(cleaned); } catch { /* */ }
  }
  throw new Error("Failed to parse vocab JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage, count = 40, exclude_words = [], difficulty = "고등" } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `너는 한국 ${difficulty} 학생용 영어 독해 자료에서 학습 가치가 높은 어휘를 추출하는 엔진이다.

아래 단계를 순서대로 적용하여 최종 어휘 목록(words)과 숙어 목록(phrases)을 JSON으로만 출력하라.

═══ Step A. 전처리 ═══
- 지문을 소문자화
- 따옴표/대시를 일반 문자로 정리
- 하이픈 단어는 분리: mind-as-computer → mind, as, computer (각각 별도 평가)

═══ Step B. 토큰화 + 품사/표제어 ═══
- 토큰화하고 lemma(표제어)를 만든다
- 품사(pos)는 동/명/형/부 로 구분
- 과거분사가 명사를 수식하거나 보어로 쓰이면 반드시 '형'으로 표기
- 고유명사(인명, 지명, 국가명 등)는 감지하여 제외

═══ Step C. Hard Filter (무조건 제거) ═══
- stopwords (관사/전치사/대명사/조동사/접속사 등) 제거
- 숫자/기호 토큰 제거
- 길이 2 이하 토큰 제거
- 고유명사 제거 (United States, Jerome Bruner, Moon 등)

═══ Step D. 일반 동사 블랙리스트 (무조건 제거) ═══
동사인데 lemma가 아래 중 하나면 무조건 제거:
be, have, make, take, get, come, go, see, say, give, find, know, think, use, keep, follow, hold, put, set, show, do, let, seem, want, need, try, look, tell, ask, feel, leave, call, run, turn, help, move, work, play, start, begin, end, stop, bring, stand, mean

═══ Step E. 빈도 기반 컷 (쉬운 단어 제거) ═══
아래 쉬운 단어들은 무조건 제거:
people, way, world, life, time, thing, place, year, day, hand, part, point, case, fact, home, group, room, area, side, line, head, end, kind, form, level, mind, body, name, word, power, state, water, house, school, story, money, food, game, air, land, eye, face, door, car, city, book, road, number, question, answer, example, problem, system, order, change, reason, result, idea, study, field, issue, type, matter, interest, sense, course, experience, effort, process, plan, control, law, market, period, class, person, family, country, center, figure, company, table, effect

═══ Step F. 점수 기반 선택 ═══
각 lemma에 score를 계산:

(1) 추상 접미사 보너스 +3
lemma가 다음으로 끝나면 +3: -tion, -sion, -ity, -ism, -ment, -ance, -ence, -ship, -sis, -ness, -ous, -ive, -able, -ible

(2) 학술/논증 개념어 매칭 +2
다음 단어에 해당하면 +2: democracy, citizenship, suffrage, cognition, metaphor, analogy, narrative, hypothesis, evidence, objective, veracity, plausible, anthropology, humanistic, justification, interpretation, paradigm, phenomenon, perception, consciousness, ideology, infrastructure, methodology, empirical, theoretical, philosophical, sociological, psychological, epistemology, ontology, dialectic, discourse, rhetoric, pragmatic, semantic, cognitive, inherent, intrinsic, extrinsic, autonomous, deterministic, contingent, paradox, dichotomy, ambiguity, nuance, synthesis, critique, legitimacy, sovereignty, hegemony, subjectivity, authenticity, existential

(3) 수능/내신 빈출 매칭 +2
다음 단어에 해당하면 +2: restrict, maintain, abandon, confirm, disprove, reject, alter, influence, critical, commitment, distinction, residence, interpret, perspective, fundamental, assumption, principle, consequence, contribute, significant, particular, demonstrate, establish, emphasis, circumstance, inevitable, considerable, determine, obstacle, adequate, profound, proportion, priority, alternative, controversial, tendency, implication, apparent, deliberate, speculate, subsequent, sustain, diminish, embrace, reluctant, compatible, constitute, conventional, cultivate, deprive, encounter, undergo, compel, contradict, dominate, prevail, supplement, cease, violate, impose, transform, derive

(4) 핵심 위치 보너스 +1
각 문장의 앞쪽 1/3에서 등장하면 +1

(5) 동사 Allowlist 보너스 +2
동사가 다음 allowlist에 있으면 +2: interpret, restrict, confirm, disprove, maintain, recognize, reveal, reject, alter, influence, abandon, countenance, describe, incline, locate, prove, perceive, convey, facilitate, impede, undermine, reinforce, articulate, exemplify, substantiate, refute, postulate, designate, perpetuate, necessitate, reconcile, transcend, accentuate, alleviate, exacerbate, mitigate, precipitate, proliferate, elucidate, delineate

═══ Step G. 최종 선택 규칙 ═══
- 기본 단어 출력 기준: score >= 3
- 동사는 더 엄격하게: score >= 4
- score 내림차순, 그 다음 본문 등장 빈도 내림차순으로 정렬
- 최대 ${count}개까지 출력 (지문이 짧으면 그보다 적을 수 있음)
- word는 반드시 공백 없는 단일 단어 (2단어 이상 조합 금지)

═══ Phrases (숙어/표현) ═══
지문에서 아래 숙어 DB에 매칭되는 2~4단어 표현을 추출:
after all, no doubt, come across, in fact, throw away, take part in, when it comes to, make sense out of, lead back to, turn to, push forward, wedded to, in terms of, as a result, on the other hand, in other words, for instance, by contrast, on behalf of, in the face of, give rise to, bring about, carry out, point out, set up, break down, come up with, put forward, account for, result in, consist of, depend on, refer to, relate to, deal with, look into, rule out, take into account, boil down to, stem from, at the expense of, in light of, with regard to, as opposed to, in conjunction with, prior to, subsequent to, regardless of, in accordance with, by means of, for the sake of, on the grounds that, to the extent that, in the long run, at stake, stand for, fall short of, keep pace with, live up to, do away with, get rid of, let alone, so as to, not to mention

각 phrase 항목: { phrase, meaning_ko }

═══ 절대 규칙 ═══
- JSON 객체만 출력. 다른 텍스트 금지.
- exclude_words에 포함된 단어 절대 제외: [${exclude_words.join(", ")}]
- in_context는 반드시 원문에서 연속된 2~6단어 그대로 인용

출력 형식:
{"words":[{"word":"...","pos":"동","meaning_ko":"...","in_context":"..."},...], "phrases":[{"phrase":"...","meaning_ko":"..."},...]}`;

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

    const parsed = safeParseJson(content);
    
    // Support both old format (array) and new format ({words, phrases})
    const vocab = Array.isArray(parsed) ? parsed : (parsed.words || []);
    const phrases = Array.isArray(parsed) ? [] : (parsed.phrases || []);

    return new Response(JSON.stringify({ vocab, phrases }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-vocab error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
