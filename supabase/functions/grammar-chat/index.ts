import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompt = `역할: 한국 중3·고1 내신 영어 시험 대비 구문분석 전문 어시스턴트.
목표: 선생님(사용자)과 대화하며 구문분석 노트를 함께 다듬는다.

■ 맥락
- 사용자는 학원/학교 영어 선생님이다.
- 사용자는 AI가 자동 생성한 구문분석 노트를 보고, 수정을 요청하거나 문법 질문을 한다.
- 구문분석 노트는 한 영어 문장에 대한 문법·구문 해설 목록이다.

■ 전문 분야
- 한국 내신 영어 시험에서 자주 출제되는 문법 포인트:
  관계대명사(who/which/that/whose/whom), 관계부사(where/when/why/how),
  분사구문(현재분사/과거분사), to부정사(명사적/형용사적/부사적 용법),
  가정법(과거/과거완료/혼합), 도치 구문, 강조 구문(It is ~ that),
  동명사 vs to부정사, 접속사(that/whether/if), 비교급·최상급,
  수동태, 사역동사(make/let/have/get), 지각동사, 가주어·가목적어 구문,
  병렬 구조, 삽입절, 동격 that, 복합관계사(whatever/whoever 등)
- 위 문법 사항을 내신 시험 출제 관점에서 정확하게 설명할 수 있어야 한다.

■ 대화 유형별 응답
1. 수정 요청 (예: "더 짧게", "문법 용어 추가해줘", "이 포인트 빼줘")
   → 수정된 구문분석 노트를 제공한다.
   → 반드시 [수정안] 태그로 감싸서 출력한다.
   → 형식: [수정안]수정된 노트 내용(번호 없이, 각 포인트를 줄바꿈으로 구분)[/수정안]

2. 질문 (예: "여기서 that은 관계대명사야 접속사야?", "이 분사구문 주어가 뭐야?")
   → 질문에 답한다. 수정안은 포함하지 않는다.

3. 수정 + 질문 동시
   → 질문에 답하고, 수정안도 함께 제공한다.

■ 수정안 규칙
- 각 포인트는 한 줄, 줄바꿈으로 구분
- 번호(1. 2.)를 붙이지 않는다 (프론트엔드에서 자동 부여)
- 3단어 이상 구문은 물결(~) 약어 사용 (예: 'who~scholarship')
- 큰따옴표(" ") 사용 금지
- 연관된 포인트는 슬래시(/)로 구분하여 단일 행 구성 가능
- 설명은 간결하되 문법 용어를 정확히 사용
- 원문 의미를 벗어나지 않기
- "~임", "~됨", "~함", "~있음" 등 음슴체 종결 절대 금지. 아래 변환을 반드시 따를 것:
  ✗ 역할임 → ✓ 역할 / ✗ 구조임 → ✓ 구조 / ✗ 수일치함 → ✓ 수일치
  ✗ 수동의 의미임 → ✓ 수동의 의미 / ✗ 목적격 보어 역할임 → ✓ 목적격 보어 역할
- 명사형(~역할, ~의미, ~구조) 또는 동사 원형(~이끔, ~나타냄)으로 끝낼 것

■ 문법 질문 응답
- 사용자가 문법 판별 질문(예: "이거 관계대명사야?", "여기 that은 접속사야?")을 하면, 해당 문장에서 구체적 근거(어떤 단어가 어떤 역할, 어떤 구조적 특징)를 들어 판단 이유를 명확히 설명하라.
- 단순히 "맞습니다" / "아닙니다"로 끝내지 말고, 왜 그런지 문장 내 근거를 제시하라.
- 문법 용어를 정확히 사용하되, 선생님이 학생에게 설명하듯 논리적으로 풀어줘라.

■ 반복 금지 원칙
- 이전 대화에서 제공한 수정안과 동일하거나 거의 같은 내용을 반복하지 말 것.
- 사용자가 수정을 요청하면 반드시 이전과 다른 새로운 관점·표현·구조의 수정안을 제시하라.

■ 대화 말투
- 존댓말 사용 (선생님에게 답하는 어시스턴트)
- 간결하고 핵심적으로 답변
- 불필요한 서론 없이 바로 본론`;

function chatOneLine(s: string) {
  return String(s ?? "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chatNormalizeTagKey(s: string): string {
  return chatOneLine(s).toLowerCase().replace(/\s+/g, "");
}

function chatCanonicalTagKey(raw: string): string {
  const key = chatNormalizeTagKey(raw);
  if (!key) return "";

  const aliases: Record<string, string> = {
    "주관대": "관계대명사",
    "목관대": "관계대명사",
    "관계사": "관계대명사",
    "관계대명사": "관계대명사",
    "관계부사": "관계부사",
    "동격접": "동격접",
    "동격": "동격접",
    "5형식": "5형식",
    "5형식(o.c)": "5형식",
    "5형식oc": "5형식",
    "목적격보어": "5형식",
    "분사후치수식": "분사후치수식",
    "분사": "분사",
    "분사구문": "분사구문",
    "to부정사": "to부정사",
    "명사절": "명사절",
    "수동태": "수동태",
    "조동사+수동": "조동사+수동",
    "수일치": "수일치",
    "병렬구조": "병렬구조",
    "전치사+동명사": "전치사+동명사",
    "전치사+관계대명사": "전치사+관계대명사",
    "비교구문": "비교구문",
    "강조구문": "강조구문",
    "생략": "생략",
    "지칭": "지칭",
    "숙어/표현": "숙어/표현",
    "기타": "기타",
  };

  if (aliases[key]) return aliases[key];
  return key;
}

function chatDetectUiTagFromContent(content: string): string {
  const c = chatOneLine(content).toLowerCase();
  if (c.includes("동격") && (c.includes("접속사") || c.includes("that") || c.includes("동격접"))) return "동격접";
  if (c.includes("관계사")) {
    if (c.includes("계속적") && (c.includes("용법") || c.includes("관계"))) return "계속적용법 관계대명사";
    if (c.includes("where") || c.includes("when") || c.includes("why") || c.includes("how")) return "관계부사";
    return "관계대명사";
  }
  if (c.includes("관계대명사") || c.includes("주관대") || c.includes("목관대")) return "관계대명사";
  if (c.includes("관계부사")) return "관계부사";
  if (c.includes("분사구문")) return "분사구문";
  if (c.includes("후치수식") || c.includes("후치")) return "분사 후치수식";
  if (c.includes("조동사") && c.includes("수동")) return "조동사+수동";
  if (c.includes("현재완료") && c.includes("수동")) return "현재완료+수동";
  if (c.includes("수동태") || c.includes("be p.p") || c.includes("to be pp") || c.includes("to be p.p")) return "수동태";
  if (c.includes("to부정사") || c.includes("to-v")) return "to부정사";
  if (c.includes("명사절")) return "명사절";
  if (c.includes("가주어") || c.includes("진주어")) return "가주어/진주어";
  if (c.includes("가목적어") || c.includes("진목적어")) return "가목적어/진목적어";
  if (c.includes("동명사") && c.includes("주어")) return "동명사주어";
  if (c.includes("5형식") || c.includes("목적격보어")) return "5형식";
  if (c.includes("4형식")) return "4형식";
  if (c.includes("병렬")) return "병렬구조";
  if (c.includes("전치사") && c.includes("동명사")) return "전치사+동명사";
  if (c.includes("so") && c.includes("that") && (c.includes("~") || c.includes("구문") || c.includes("결과"))) return "so~that";
  if (c.includes("too") && c.includes("to") && (c.includes("~") || c.includes("구문"))) return "too~to";
  if (c.includes("as") && c.includes("as") && (c.includes("형") || c.includes("부") || c.includes("원급"))) return "as 형부 as";
  if (c.includes("비교") || c.includes("최상급")) return "비교구문";
  if (c.includes("수일치")) return "수일치";
  if (c.includes("생략")) return "생략";
  if (c.includes("숙어") || c.includes("구동사") || c.includes("표현")) return "숙어/표현";
  if (c.includes("강조") && (c.includes("구문") || c.includes("it is") || c.includes("it was"))) return "강조구문";
  if (c.includes("계속적") && (c.includes("용법") || c.includes("관계"))) {
    if (c.includes("부사")) return "계속적 용법 관계부사";
    return "계속적용법 관계대명사";
  }
  if (c.includes("대동사")) return "대동사";
  if (c.includes("분사") && !c.includes("분사구문") && !c.includes("후치")) return "분사";
  if (c.includes("전치사") && c.includes("관계")) return "전치사+관계대명사";
  if (c.includes("to be pp") || c.includes("to be p.p")) return "to be pp";
  return "기타";
}

function chatExtractPinnedTemplateValues(raw: string): string[] {
  const values: string[] = [];
  const push = (value?: string) => {
    const normalized = chatOneLine(String(value ?? "")).replace(/^[()]+|[()]+$/g, "").trim();
    if (!normalized) return;
    if (!values.includes(normalized)) values.push(normalized);
  };

  const patterns = [
    /관계(?:사|대명사|부사)\s+([A-Za-z][A-Za-z' -]*)/g,
    /형용사절\(([^)]+)\)/g,
    /명사절\(([^)]+)\)/g,
    /부사절\(([^)]+)\)/g,
    /선행사\s+([A-Za-z][A-Za-z' -]*)/g,
    /동사\s+([A-Za-z][A-Za-z' -]*)/g,
    /목적어\(?([A-Za-z][A-Za-z' -]*)\)?/g,
    /보어\(?([A-Za-z][A-Za-z' -]*)\)?/g,
    /\(([A-Za-z][A-Za-z' -]*~[A-Za-z][A-Za-z' -]*)\)/g,
  ];

  for (const re of patterns) {
    for (const match of raw.matchAll(re)) push(match[1]);
  }
  return values;
}

function chatExtractEnglishSegments(text: string): string[] {
  return (text.match(/[A-Za-z][A-Za-z0-9'~\-\s]*[A-Za-z0-9]/g) || []).map(s => s.trim()).filter(s => s.length >= 2);
}

function chatExtractKoreanStructure(template: string): { prefix: string; suffix: string; koreanParts: string[] } {
  const t = chatOneLine(template);
  // Split into Korean segments and English segments
  const parts = t.split(/([A-Za-z][A-Za-z0-9'~\-\s]*[A-Za-z0-9])/g);
  const koreanParts = parts.filter((_, i) => i % 2 === 0).map(s => s.trim()).filter(Boolean);
  const prefix = koreanParts[0] || "";
  const suffix = koreanParts[koreanParts.length - 1] || "";
  return { prefix, suffix, koreanParts };
}

function chatMaterializePinnedPattern(template: string, raw: string, stripLeadingTagLabel: (line: string) => string): string {
  const normalizedTemplate = stripLeadingTagLabel(chatOneLine(template));
  const normalizedRaw = stripLeadingTagLabel(chatOneLine(raw));

  if (normalizedTemplate.includes("___")) {
    const values = chatExtractPinnedTemplateValues(normalizedRaw);
    if (values.length === 0) return normalizedTemplate;
    let idx = 0;
    const filled = normalizedTemplate.replace(/___/g, () => values[idx++] ?? values[values.length - 1] ?? "___");
    return filled;
  }

  // No placeholders: enforce Korean structure from template while swapping English from AI output
  const templateEnglish = chatExtractEnglishSegments(normalizedTemplate);
  const rawEnglish = chatExtractEnglishSegments(normalizedRaw);

  // If template has no English or AI output has no English, can't swap → use template structure with raw English
  if (templateEnglish.length === 0 || rawEnglish.length === 0) {
    // Still enforce template's Korean structure: replace template's English with raw's English
    return normalizedRaw.length > 0 ? normalizedRaw : normalizedTemplate;
  }

  // Build result: take template, replace its English segments with AI output's English segments
  let result = normalizedTemplate;
  const usedRaw = [...rawEnglish];
  for (const eng of templateEnglish) {
    const replacement = usedRaw.shift() || eng;
    result = result.replace(eng, replacement);
  }
  // If there are leftover raw English segments, append context
  // But generally the structure should now follow the template

  return result;
}

function chatApplyPinnedPattern(
  content: string,
  pinnedByTag: Map<string, string>,
  stripLeadingTagLabel: (line: string) => string,
  explicitUiTag?: string,
): string {
  const raw = chatOneLine(content);
  if (!raw || !pinnedByTag || pinnedByTag.size === 0) return raw;

  const candidates: string[] = [];
  if (explicitUiTag) candidates.push(explicitUiTag);
  candidates.push(chatDetectUiTagFromContent(raw));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = chatCanonicalTagKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pinned = chatOneLine(String(pinnedByTag.get(key) ?? ""));
    if (!pinned) continue;
    return chatMaterializePinnedPattern(pinned, raw, stripLeadingTagLabel);
  }

  return raw;
}

type ChatReqMessage = { role?: string; content?: string };

function chatLatestUserText(messages: ChatReqMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return chatOneLine(messages[i]?.content ?? "");
  }
  return "";
}

function chatWantsReanalysis(userText: string): boolean {
  const t = chatOneLine(userText).toLowerCase();
  if (!t) return false;
  return /틀렸|아니|다시|재분석|처음부터|문법\s*바꿔|분류\s*바꿔|전혀\s*관련|엉뚱|무관|다시\s*봐/.test(t);
}

function chatExtractEnglishTokens(text: string): string[] {
  return (String(text ?? "").match(/[A-Za-z][A-Za-z0-9'\-]*/g) || []).map((w) => w.toLowerCase());
}

function chatLooksUnrelatedToSentence(
  suggestionNotes: string[] | null,
  sentence: string,
  currentNotes: any[],
): boolean {
  if (!suggestionNotes || suggestionNotes.length === 0) return false;

  const grammarMeta = new Set([
    "that", "which", "who", "whom", "whose", "when", "where", "why", "how",
    "it", "be", "is", "are", "was", "were", "am", "been", "being",
    "to", "for", "as", "if", "than", "not", "only", "both", "either", "neither",
    "v", "n", "adj", "adv", "pp", "oc", "ing",
    "subject", "object", "complement", "clause", "phrase", "passive", "active",
    "relative", "noun", "verb", "participle", "gerund", "infinitive",
  ]);
  const sentenceSet = new Set(chatExtractEnglishTokens(sentence).filter((w) => w.length >= 2));
  const noteText = Array.isArray(currentNotes) ? currentNotes.map((n: any) => String(n?.content ?? "")).join(" ") : "";
  const noteSet = new Set(chatExtractEnglishTokens(noteText).filter((w) => w.length >= 2));

  const unknown = new Set<string>();
  for (const line of suggestionNotes) {
    for (const token of chatExtractEnglishTokens(line)) {
      if (token.length < 5) continue;
      if (grammarMeta.has(token)) continue;
      if (sentenceSet.has(token)) continue;
      if (noteSet.has(token)) continue;
      unknown.add(token);
    }
  }
  return unknown.size >= 3;
}

function chatExtractRequiredGrammarFrames(note: string): string[] {
  const text = chatOneLine(note);
  const frames = [
    "형용사절",
    "명사절",
    "부사절",
    "관계대명사",
    "관계부사",
    "동격",
    "수동태",
    "분사구문",
    "to부정사",
    "가주어",
    "가목적어",
    "강조구문",
    "병렬",
    "수일치",
    "5형식",
  ];
  return frames.filter((f) => text.includes(f));
}

function chatPreservesGrammarFrames(originalNote: string, newNote: string): boolean {
  const required = chatExtractRequiredGrammarFrames(originalNote);
  if (required.length === 0) return true;
  const next = chatOneLine(newNote);
  return required.every((f) => next.includes(f));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sentence, currentNotes, fullPassage, targetNoteIndex, userId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Missing messages array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notesText = Array.isArray(currentNotes)
      ? currentNotes.map((n: any, i: number) => `${i + 1}. ${n.content}`).join("\n")
      : "없음";

    const isTargeted = typeof targetNoteIndex === "number" && Array.isArray(currentNotes) && currentNotes[targetNoteIndex];
    const targetNote = isTargeted ? currentNotes[targetNoteIndex] : null;

    let contextBlock: string;
    if (isTargeted && targetNote) {
      contextBlock = [
        fullPassage ? `[전체 지문]\n${fullPassage}` : "",
        `[현재 문장]\n${sentence}`,
        `[전체 구문분석 노트]\n${notesText}`,
        `[수정 대상: ${targetNoteIndex + 1}번 포인트]\n${targetNote.content}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    } else {
      contextBlock = [
        fullPassage ? `[전체 지문]\n${fullPassage}` : "",
        `[현재 문장]\n${sentence}`,
        `[현재 구문분석 노트]\n${notesText}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    const targetedSystemAddendum = isTargeted
      ? `\n\n■ 개별 포인트 수정 모드
- 현재 ${targetNoteIndex! + 1}번 포인트만 수정 대상이다.
- 수정안은 해당 포인트 1개에 대한 수정 내용만 반환하라 (한 줄).
- 다른 포인트는 건드리지 않는다.`
      : "";

    // ── Trust & Feedback addendum ──
    const latestUserText = chatLatestUserText(messages);
    const allowReanalysis = chatWantsReanalysis(latestUserText);

    const trustAddendum = allowReanalysis
      ? `\n\n■ 재분석 모드
- 사용자가 기존 분석 오류를 지적했으므로, 현재 문장을 기준으로 해당 포인트를 다시 판단하라.
- 기존 포인트의 문법 분류가 틀렸다면 수정 가능.
- 단, 수정안은 반드시 현재 문장에 실제 존재하는 근거(단어/구문)로만 작성하라.
- 현재 문장과 무관한 예시 단어·고유명사·다른 지문 내용은 절대 쓰지 말 것.`
      : `\n\n■ 현재 분석 신뢰 원칙
- 현재 구문분석 노트의 문법 판단(동격/관계대명사/분사/수동태 등)은 선생님이 확인한 것이다.
- 이 판단을 임의로 바꾸지 말고 그대로 유지한 채 표현·서술만 수정하라.
- 사용자가 명시적으로 "이거 관계대명사 아니라 접속사야" 등 문법 분류 자체를 바꾸라고 하지 않는 한, 기존 문법 분류를 유지하라.

■ 사용자 피드백 수용
- 사용자가 "틀렸어", "아니야", "다시 해줘" 등으로 오류를 지적하면, 이전 답변을 그대로 반복하지 말 것.
- 문장을 처음부터 다시 분석하여 새로운 답변을 제시하라.
- 이전 대화에서 틀린 분석이 있었다면 그것을 참고하지 말고 무시하라.`;

    // ── Fetch pinned patterns — SCOPED to current note tags only ──
    let pinnedBlock = "";
    const pinnedByTag = new Map<string, string>();
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const patternsRes = await fetch(
          `${supabaseUrl}/rest/v1/syntax_patterns?is_global=eq.true&order=created_at.desc&select=tag,pinned_content`,
          { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
        );
        if (patternsRes.ok) {
          const allPatterns = await patternsRes.json();

          // Detect tags from current notes to scope pattern injection
          const activeTagKeys = new Set<string>();
          if (isTargeted && targetNote) {
            // Single-point mode: only the target note's tag
            const tag = chatDetectUiTagFromContent(targetNote.content);
            activeTagKeys.add(chatCanonicalTagKey(tag));
          } else if (Array.isArray(currentNotes)) {
            // Full mode: tags from all current notes
            for (const n of currentNotes) {
              const tag = chatDetectUiTagFromContent(n.content || "");
              activeTagKeys.add(chatCanonicalTagKey(tag));
            }
          }
          // Remove empty/기타 to avoid pulling unrelated patterns
          activeTagKeys.delete("");
          activeTagKeys.delete("기타");

          const relevantPatterns: any[] = [];
          const tagCount = new Map<string, number>(); // cap per tag
          for (const p of allPatterns) {
            const tag = String(p?.tag ?? "").trim();
            const content = String(p?.pinned_content ?? "").trim();
            if (!tag || !content) continue;
            const tagKey = chatCanonicalTagKey(tag);

            // Include pattern if its tag matches any active note tag
            let matched = false;
            for (const activeKey of activeTagKeys) {
              if (tagKey === activeKey) {
                matched = true;
                break;
              }
            }
            if (matched) {
              const count = tagCount.get(tagKey) || 0;
              if (count >= 2) continue; // ★ Cap: max 2 patterns per tag
              tagCount.set(tagKey, count + 1);
              relevantPatterns.push(p);
            }
          }

          console.log(`[grammar-chat] Active tags: [${[...activeTagKeys].join(", ")}], Matched ${relevantPatterns.length}/${allPatterns.length} patterns`);

          if (relevantPatterns.length > 0) {
            for (const p of relevantPatterns) {
              const tag = String(p?.tag ?? "").trim();
              const content = String(p?.pinned_content ?? "").trim();
              const key = chatCanonicalTagKey(tag);
              if (key && content && !pinnedByTag.has(key)) pinnedByTag.set(key, content);
            }
            const tagLines = relevantPatterns.map((p: any) => `- ${p.tag}: ${p.pinned_content}`).join("\n");
            pinnedBlock = `\n\n[필수 적용 규칙 — 고정 패턴]\n` +
              `아래 패턴은 사용자가 직접 지정한 필수 설명 형식이다.\n` +
              `해당 문법 요소가 문장에 존재하면, 반드시 아래 패턴의 설명 구조·말투·종결 방식을 그대로 따라야 한다.\n` +
              `너 자신의 설명 방식이나 표현을 사용하지 말고, 아래 패턴의 구조·어휘·종결 방식을 정확히 복제하라.\n` +
              `단, 패턴에 포함된 영어 단어(예: what, important, built 등)는 절대 그대로 쓰지 말 것.\n` +
              `영어 단어와 구문 범위는 반드시 현재 문장의 실제 내용으로 교체하라.\n` +
              `___가 있으면 해당 문장의 실제 단어로 교체하라.\n` +
              `문장에 해당 문법 요소가 없으면 이 패턴을 완전히 무시하라. 억지로 적용하지 말 것.\n` +
              `${tagLines}\n` +
              `출력에 태그명 접두어(예: 관계대명사:, 5형식:)를 붙이지 말 것.`;
          }
        }
      }
    } catch {}

    // ★ History filtering: strip [수정안] blocks from ALL assistant messages to prevent anchoring
    let filteredMessages = messages.map((m: any) => {
      if (m?.role === "assistant" && typeof m.content === "string") {
        const stripped = m.content.replace(/\[수정안\][\s\S]*?\[\/수정안\]/g, "").trim();
        return { ...m, content: stripped || "(수정안 제거됨)" };
      }
      return m;
    });

    // Additionally, when reanalysis is requested, mask the last assistant message entirely
    if (allowReanalysis && filteredMessages.length >= 2) {
      for (let i = filteredMessages.length - 2; i >= 0; i--) {
        if (filteredMessages[i]?.role === "assistant") {
          filteredMessages[i] = {
            role: "assistant",
            content: "[이전 답변은 오류로 판정됨 — 이 내용을 참고하거나 반복하지 말 것. 문장을 처음부터 다시 분석하라.]",
          };
          break;
        }
      }
    }

    const aiMessages = [
      { role: "system", content: systemPrompt + targetedSystemAddendum + trustAddendum + pinnedBlock },
      {
        role: "system",
        content: `아래는 현재 작업 중인 문장과 구문분석 노트입니다:\n\n${contextBlock}`,
      },
      ...filteredMessages,
    ];

    async function callChatCompletion(extraSystemInstruction = ""): Promise<string> {
      const callMessages = extraSystemInstruction
        ? [{ role: "system", content: extraSystemInstruction }, ...aiMessages]
        : aiMessages;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: callMessages,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        if (response.status === 429) {
          throw Object.assign(new Error("요청이 너무 많습니다. 잠시 후 다시 시도해주세요."), { status: 429 });
        }
        if (response.status === 402) {
          throw Object.assign(new Error("크레딧이 부족합니다."), { status: 402 });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      return String(data.choices?.[0]?.message?.content ?? "").trim();
    }

    let content = await callChatCompletion();

    // Extract suggestion if present
    let suggestionMatch = content.match(/\[수정안\]([\s\S]*?)\[\/수정안\]/);
    let suggestion = suggestionMatch ? suggestionMatch[1].trim() : null;

    // Sanitize forbidden endings without truncating valid words like "쓰임/보임/취함"
    function sanitizeEndings(text: string): string {
      return String(text ?? "")
        .replace(/역할임(?=[.\s/,)~]|$)/g, "역할")
        .replace(/구조임(?=[.\s/,)~]|$)/g, "구조")
        .replace(/의미임(?=[.\s/,)~]|$)/g, "의미")
        .replace(/수일치함(?=[.\s/,)~]|$)/g, "수일치")
        .replace(/수동의 의미임(?=[.\s/,)~]|$)/g, "수동의 의미")
        .replace(/목적격 보어 역할임(?=[.\s/,)~]|$)/g, "목적격 보어 역할");
    }

    function repairTruncatedSyntaxPhrases(text: string): string {
      let out = String(text ?? "");
      out = out.replace(/구동사로\s*쓰(?=\s*(?:\/|$))/g, "구동사로 쓰임");
      out = out.replace(/표현으로\s*쓰(?=\s*(?:\/|$))/g, "표현으로 쓰임");
      out = out.replace(/구조로\s*쓰(?=\s*(?:\/|$))/g, "구조로 쓰임");
      out = out.replace(/용법으로\s*쓰(?=\s*(?:\/|$))/g, "용법으로 쓰임");
      out = out.replace(/((?:[가-힣A-Za-z]+\s+){0,2}용법)으로\s*쓰(?=\s*(?:\/|$))/g, "$1으로 쓰임");
      out = out.replace(/\s{2,}/g, " ").trim();
      return out;
    }

    const TAG_PREFIX_LABELS = [
      "관계대명사",
      "관계부사",
      "분사구문",
      "분사 후치수식",
      "수동태",
      "조동사+수동",
      "to부정사",
      "명사절",
      "가주어/진주어",
      "가목적어/진목적어",
      "5형식",
      "병렬구조",
      "전치사+동명사",
      "비교구문",
      "수일치",
      "생략",
      "지칭",
      "숙어/표현",
      "기타",
    ];

    function escapeRegex(text: string) {
      return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    const TAG_PREFIX_RE = new RegExp(
      `^\\s*(?:[•·\\-*]\\s*)?(?:\\d+[\\).]\\s*)?(?:${TAG_PREFIX_LABELS.map(escapeRegex).join("|")})\\s*:\\s*`,
      "u"
    );

    function stripLeadingTagLabel(line: string) {
      let out = String(line ?? "").replace(TAG_PREFIX_RE, "").trim();
      out = out.replace(/^([가-힣][가-힣A-Za-z0-9_+/\-\s]{0,24})\s*:\s*/u, "").trim();
      out = out.replace(/^([A-Z][A-Z0-9_+/\-\s]{1,24})\s*:\s*/, "").trim();
      return out;
    }

    function stripTrailingFieldLabel(line: string) {
      return String(line ?? "")
        .replace(/,\s*"?tag"?\s*:\s*$/gi, "")
        .replace(/\s*"?tag"?\s*:\s*$/gi, "")
        .replace(/,\s*"?finish_reason"?\s*:\s*$/gi, "")
        .replace(/\s*"?finish_reason"?\s*:\s*$/gi, "")
        .replace(/\s*[A-Za-z0-9_]*assistant[A-Za-z0-9_]*syntax[A-Za-z0-9_]*points?:tag:\s*$/gi, "")
        .replace(/\s*[A-Za-z0-9_]*syntax[A-Za-z0-9_]*result[A-Za-z0-9_]*points?:tag:\s*$/gi, "")
        .replace(/\s*[A-Za-z0-9_]+(?:_[A-Za-z0-9_]+){2,}:tag:\s*$/g, "")
        .trim();
    }

    const targetUiTag = targetNote?.content ? chatDetectUiTagFromContent(targetNote.content) : "";

    function finalizeSyntaxText(text: string): string {
      let out = String(text ?? "").replace(/^\s*\d+\.\s*/, "").trim();
      for (let i = 0; i < 3; i += 1) {
        const next = stripLeadingTagLabel(
          stripTrailingFieldLabel(
            repairTruncatedSyntaxPhrases(
              sanitizeEndings(out)
            )
          )
        );
        if (next === out) break;
        out = next;
      }
      return out;
    }

    // Parse suggestion into array of note strings
    let suggestionNotes: string[] | null = null;
    const parseSuggestionNotes = (rawSuggestion: string | null): string[] | null => {
      if (!rawSuggestion) return null;
      return rawSuggestion
        .split("\n")
        .map((line: string) =>
          finalizeSyntaxText(
            chatApplyPinnedPattern(
              finalizeSyntaxText(line),
              pinnedByTag,
              stripLeadingTagLabel,
              targetUiTag,
            )
          )
        )
        .filter((line: string) => line.length > 0);
    };

    suggestionNotes = parseSuggestionNotes(suggestion);

    // Safety gate: reject clearly unrelated edits and retry once with stricter constraint.
    if (chatLooksUnrelatedToSentence(suggestionNotes, sentence, currentNotes)) {
      const strictInstruction = `이전 수정안은 현재 문장과 무관한 영어 어휘가 섞여 오류였다.
반드시 현재 문장에 실제 존재하는 영어 단어/구문을 근거로만 수정하라.
다른 문장의 단어(예: 고유명사, 다른 예문 어휘) 절대 사용 금지.`;
      content = await callChatCompletion(strictInstruction);
      suggestionMatch = content.match(/\[수정안\]([\s\S]*?)\[\/수정안\]/);
      suggestion = suggestionMatch ? suggestionMatch[1].trim() : null;
      suggestionNotes = parseSuggestionNotes(suggestion);
    }

    // Guard rail: in targeted-edit mode, keep original grammar frame unless user requested reanalysis.
    if (isTargeted && targetNote && !allowReanalysis && suggestionNotes && suggestionNotes.length > 0) {
      const first = suggestionNotes[0];
      if (!chatPreservesGrammarFrames(String(targetNote.content ?? ""), first)) {
        const keepFrameInstruction = `현재는 포인트 표현 수정 모드다.
수정 대상 포인트의 기존 문법 프레임(예: 형용사절/명사절/관계대명사/수동태 등)은 절대 바꾸지 말고 유지하라.
기존 포인트의 문법 프레임 키워드를 그대로 포함한 1줄 [수정안]만 반환하라.`;
        content = await callChatCompletion(keepFrameInstruction);
        suggestionMatch = content.match(/\[수정안\]([\s\S]*?)\[\/수정안\]/);
        suggestion = suggestionMatch ? suggestionMatch[1].trim() : null;
        suggestionNotes = parseSuggestionNotes(suggestion);

        // If it still breaks the frame, fail closed to avoid writing wrong analysis.
        if (!suggestionNotes || suggestionNotes.length === 0 || !chatPreservesGrammarFrames(String(targetNote.content ?? ""), suggestionNotes[0])) {
          suggestionNotes = [finalizeSyntaxText(String(targetNote.content ?? ""))];
        }
      }
    }

    return new Response(
      JSON.stringify({ reply: content, suggestion, suggestionNotes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("grammar-chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: e.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
