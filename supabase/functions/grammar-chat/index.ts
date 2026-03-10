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

■ 대화 말투
- 존댓말 사용 (선생님에게 답하는 어시스턴트)
- 간결하고 핵심적으로 답변
- 불필요한 서론 없이 바로 본론`;

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

    // Fetch learning examples
    let learningBlock = "";
    if (userId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrl && serviceRoleKey) {
          const url = `${supabaseUrl}/rest/v1/learning_examples?user_id=eq.${userId}&type=eq.syntax&order=created_at.desc&limit=3&select=sentence,ai_draft,final_version`;
          const res = await fetch(url, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
          if (res.ok) {
            const examples = await res.json();
            if (examples.length > 0) {
              const lines = examples.map((e: any) => `원문: ${e.sentence}\nAI초안: ${e.ai_draft}\n최종: ${e.final_version}`).join("\n---\n");
              learningBlock = `\n\n[사용자 선호 스타일 예시]\n${lines}`;
            }
          }
        }
      } catch {}
    }

    const aiMessages = [
      { role: "system", content: systemPrompt + targetedSystemAddendum + learningBlock },
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

    // Parse suggestion into array of note strings
    let suggestionNotes: string[] | null = null;
    if (suggestion) {
      suggestionNotes = suggestion
        .split("\n")
        .map((line: string) => line.replace(/^\s*\d+\.\s*/, "").trim())
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
