import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Admin user ID cache for learning examples
let cachedAdminUid: string | null = null;
async function getAdminUserId(): Promise<string | null> {
  if (cachedAdminUid) return cachedAdminUid;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/auth/v1/admin/users?page=1&per_page=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const { users } = await res.json();
    const admin = users.find((u: any) => u.email?.toLowerCase() === "co500123@naver.com");
    if (admin) cachedAdminUid = admin.id;
    return cachedAdminUid;
  } catch { return null; }
}

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

■ 핵심 제약
- 수정안에는 반드시 [현재 문장]에 실제로 존재하는 영어 단어만 사용하라.
- [현재 문장]에 없는 영어 단어를 수정안에 절대 포함하지 말 것.
- 문법 분류(태그)는 사용자가 명시적으로 변경을 요청하지 않는 한 기존 분류를 유지하라.

■ 대화 말투
- 존댓말 사용 (선생님에게 답하는 어시스턴트)
- 간결하고 핵심적으로 답변
- 불필요한 서론 없이 바로 본론`;

// --- Utility: strip [수정안] blocks from message content ---
function stripSuggestionBlocks(content: string): string {
  return content.replace(/\[수정안\][\s\S]*?\[\/수정안\]/g, "").trim();
}

// --- Utility: detect negative feedback ---
const NEGATIVE_PATTERNS = /(?:틀렸|틀린|아니[야요]?|아닌데|다시|잘못|안 맞|맞지 않|고쳐|바꿔|수정해|다른|제대로|엉뚱|이상해|이상한)/;

function isNegativeFeedback(text: string): boolean {
  return NEGATIVE_PATTERNS.test(text);
}

// --- Utility: filter patterns relevant to current context ---
function filterRelevantPatterns(
  patterns: Array<{ tag: string; pinned_content: string }>,
  currentNotes: Array<{ content: string; tag?: string }> | null,
  targetNote: { content: string; tag?: string } | null,
  maxCount: number = 3
): Array<{ tag: string; pinned_content: string }> {
  if (!patterns || patterns.length === 0) return [];

  // Collect relevant tags from target note or all current notes
  const relevantTags = new Set<string>();
  if (targetNote?.tag) {
    relevantTags.add(targetNote.tag);
  } else if (currentNotes) {
    for (const note of currentNotes) {
      if (note.tag) relevantTags.add(note.tag);
    }
  }

  if (relevantTags.size === 0) return patterns.slice(0, maxCount);

  // Filter patterns whose tag matches any relevant tag
  const matched = patterns.filter((p) => relevantTags.has(p.tag));
  return matched.slice(0, maxCount);
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

    // Fetch learning examples (always admin) + pinned patterns
    let learningBlock = "";
    let pinnedBlock = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        const adminUid = await getAdminUserId();
        const patternsReq = fetch(
          `${supabaseUrl}/rest/v1/syntax_patterns?is_global=eq.true&order=created_at.desc&select=tag,pinned_content`,
          { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
        );
        const learningReq = adminUid
          ? fetch(
              `${supabaseUrl}/rest/v1/learning_examples?user_id=eq.${adminUid}&type=eq.syntax&order=created_at.desc&limit=3&select=sentence,ai_draft,final_version`,
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
          const allPatterns = await patternsRes.json();
          // Filter to only relevant patterns (max 3)
          const relevantPatterns = filterRelevantPatterns(allPatterns, currentNotes, targetNote, 3);
          if (relevantPatterns.length > 0) {
            const tagLines = relevantPatterns.map((p: any) => `- ${p.tag}: ${p.pinned_content}`).join("\n");
            pinnedBlock = `\n\n[고정 패턴 — 스타일 참고]\n` +
              `아래 패턴은 말투·형식·종결어미의 스타일 참고용이다.\n` +
              `패턴의 한국어 설명 구조와 종결 형태를 따르되, 반드시 [현재 문장]의 실제 영어 단어와 문법 구조로 작성하라.\n` +
              `패턴의 예시 영어 단어를 그대로 복사하지 말 것.\n` +
              `${tagLines}\n` +
              `출력에 태그명 접두어(예: 관계대명사:, 5형식:)를 붙이지 말 것.`;
          }
        }
      }
    } catch {}

    // --- Clean message history ---
    const lastUserMsg = messages[messages.length - 1];
    const isNegative = lastUserMsg?.role === "user" && isNegativeFeedback(lastUserMsg.content || "");

    const cleanedMessages = messages.map((msg: any, idx: number) => {
      let content = msg.content || "";

      // Strip all [수정안] blocks from history to prevent anchoring
      if (msg.role === "assistant") {
        content = stripSuggestionBlocks(content);
      }

      // Mask the last assistant message if user gave negative feedback
      if (isNegative && msg.role === "assistant" && idx === messages.length - 2) {
        content = "[이전 답변 — 참고하지 말 것. 새롭게 분석하라.]";
      }

      return { role: msg.role, content };
    }).filter((msg: any) => msg.content.length > 0);

    const aiMessages = [
      { role: "system", content: systemPrompt + targetedSystemAddendum + pinnedBlock + learningBlock },
      {
        role: "system",
        content: `아래는 현재 작업 중인 문장과 구문분석 노트입니다:\n\n${contextBlock}`,
      },
      ...cleanedMessages,
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

    // Sanitize forbidden endings
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
      out = out.replace(/\s{2,}/g, " ").trim();
      return out;
    }

    const TAG_PREFIX_LABELS = [
      "관계대명사", "관계부사", "분사구문", "분사 후치수식", "수동태",
      "조동사+수동", "to부정사", "명사절", "가주어/진주어", "가목적어/진목적어",
      "5형식", "병렬구조", "전치사+동명사", "비교구문", "수일치",
      "생략", "지칭", "숙어/표현", "기타",
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

    // Parse suggestion into array of note strings
    let suggestionNotes: string[] | null = null;
    if (suggestion) {
      suggestionNotes = suggestion
        .split("\n")
        .map((line: string) =>
          stripTrailingFieldLabel(
            repairTruncatedSyntaxPhrases(
              sanitizeEndings(stripLeadingTagLabel(line.replace(/^\s*\d+\.\s*/, "").trim()))
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
