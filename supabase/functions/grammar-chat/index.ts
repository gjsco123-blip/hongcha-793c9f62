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

function chatDetectUiTagFromContent(content: string): string {
  const c = chatOneLine(content).toLowerCase();
  if (c.includes("관계사")) {
    if (c.includes("where") || c.includes("when") || c.includes("why") || c.includes("how")) return "관계부사";
    return "관계대명사";
  }
  if (c.includes("관계대명사") || c.includes("주관대") || c.includes("목관대")) return "관계대명사";
  if (c.includes("관계부사")) return "관계부사";
  if (c.includes("분사구문")) return "분사구문";
  if (c.includes("후치수식") || c.includes("후치")) return "분사 후치수식";
  if (c.includes("조동사") && c.includes("수동")) return "조동사+수동";
  if (c.includes("수동태") || c.includes("be p.p")) return "수동태";
  if (c.includes("to부정사") || c.includes("to-v")) return "to부정사";
  if (c.includes("명사절")) return "명사절";
  if (c.includes("가주어") || c.includes("진주어")) return "가주어/진주어";
  if (c.includes("가목적어") || c.includes("진목적어")) return "가목적어/진목적어";
  if (c.includes("5형식") || c.includes("목적격보어")) return "5형식";
  if (c.includes("병렬")) return "병렬구조";
  if (c.includes("전치사") && c.includes("동명사")) return "전치사+동명사";
  if (c.includes("비교") || c.includes("최상급")) return "비교구문";
  if (c.includes("수일치")) return "수일치";
  if (c.includes("생략")) return "생략";
  if (c.includes("숙어") || c.includes("구동사") || c.includes("표현")) return "숙어/표현";
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

function chatMaterializePinnedPattern(template: string, raw: string, stripLeadingTagLabel: (line: string) => string): string {
  const normalizedTemplate = stripLeadingTagLabel(chatOneLine(template));
  if (!normalizedTemplate.includes("___")) return normalizedTemplate;
  const values = chatExtractPinnedTemplateValues(raw);
  if (values.length === 0) return raw;
  let idx = 0;
  const filled = normalizedTemplate.replace(/___/g, () => values[idx++] ?? values[values.length - 1] ?? "___");
  return filled.includes("___") ? raw : filled;
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
    const key = chatNormalizeTagKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pinned = chatOneLine(String(pinnedByTag.get(key) ?? ""));
    if (!pinned) continue;
    return chatMaterializePinnedPattern(pinned, raw, stripLeadingTagLabel);
  }

  return raw;
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

    // Fetch learning examples + pinned patterns
    let learningBlock = "";
    let pinnedBlock = "";
    const pinnedByTag = new Map<string, string>();
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const patternsReq = fetch(
          `${supabaseUrl}/rest/v1/syntax_patterns?is_global=eq.true&order=created_at.desc&select=tag,pinned_content`,
          { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
        );
        const learningReq = userId
          ? fetch(
              `${supabaseUrl}/rest/v1/learning_examples?user_id=eq.${userId}&type=eq.syntax&order=created_at.desc&limit=3&select=sentence,ai_draft,final_version`,
              { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
            )
          : Promise.resolve(null);

        const [patternsRes, learningRes] = await Promise.all([patternsReq, learningReq]);

        if (learningRes?.ok) {
          const examples = await learningRes.json();
          if (examples.length > 0) {
            const lines = examples.map((e: any) => `원문: ${e.sentence}\nAI초안: ${e.ai_draft}\n최종: ${e.final_version}`).join("\n---\n");
            learningBlock = `\n\n[사용자 선호 스타일 예시]\n${lines}`;
          }
        }
        if (patternsRes.ok) {
          const patterns = await patternsRes.json();
          if (patterns.length > 0) {
            for (const p of patterns) {
              const tag = String(p?.tag ?? "").trim();
              const content = String(p?.pinned_content ?? "").trim();
              const key = chatNormalizeTagKey(tag);
              if (key && content && !pinnedByTag.has(key)) pinnedByTag.set(key, content);
            }
            const tagLines = patterns.map((p: any) => `- ${p.tag}: ${p.pinned_content}`).join("\n");
            pinnedBlock = `\n\n[고정 패턴 — 최우선 규칙]\n` +
              `아래 태그에 해당하는 포인트는 반드시 해당 패턴의 문장을 그대로 사용하라.\n` +
              `___만 실제 단어로 교체하고, 그 외 단어·구조·어순은 절대 바꾸거나 추가하지 말 것.\n` +
              `패턴에 없는 부가 설명, 슬래시(/) 뒤 추가 분석, 범위 표시 등을 덧붙이지 말 것.\n` +
              `${tagLines}\n` +
              `출력에 태그명 접두어(예: 관계대명사:, 5형식:)를 붙이지 말 것.`;
          }
        }
      }
    } catch {}

    const aiMessages = [
      { role: "system", content: systemPrompt + targetedSystemAddendum + pinnedBlock + learningBlock },
      {
        role: "system",
        content: `아래는 현재 작업 중인 문장과 구문분석 노트입니다:\n\n${contextBlock}`,
      },
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content ?? "").trim();

    // Extract suggestion if present
    const suggestionMatch = content.match(/\[수정안\]([\s\S]*?)\[\/수정안\]/);
    const suggestion = suggestionMatch ? suggestionMatch[1].trim() : null;

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
    if (suggestion) {
      suggestionNotes = suggestion
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
