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
  throw new Error("Failed to parse vocab JSON");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { raw_text, passage, existing_words = [] } = await req.json();
    if (!raw_text?.trim()) throw new Error("Missing raw_text");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `너는 영어 단어 정리 엔진이다.

사용자가 자유 형식으로 붙여넣은 단어 목록을 파싱하여 아래 JSON 형식으로 변환하라.

각 항목:
- word: 영단어 (단일 단어만)
- pos: 품사를 반드시 다음 중 하나로 변환: 동/명/형/부/접/전
  - verb, v, 동사 → 동
  - noun, n, 명사 → 명
  - adjective, adj, 형용사 → 형 (과거분사가 수식/보어로 쓰이면 '형')
  - adverb, adv, 부사 → 부
  - conjunction, conj, 접속사 → 접
  - preposition, prep, 전치사 → 전
  - 사용자가 제공한 품사를 최대한 존중하되, 위 체계로 변환
- meaning_ko: 한국어 뜻 (짧은 직역). 사용자가 뜻을 제공했으면 그대로 사용, 없으면 생성
- in_context: 제공된 지문(passage)에서 해당 단어가 포함된 연속 2~6단어 인용. 지문에 없으면 빈 문자열

규칙:
- JSON 배열만 출력. 다른 텍스트 금지.
- 다음 단어는 이미 존재하므로 제외: [${existing_words.join(", ")}]
- 중복 단어 제거
- 기능어(a, the, is, are 등) 제외

출력 형식:
[{"word":"...","pos":"동","meaning_ko":"...","in_context":"..."},...]`;

    const userContent = passage
      ? `[붙여넣은 단어 목록]\n${raw_text}\n\n[지문]\n${passage}`
      : `[붙여넣은 단어 목록]\n${raw_text}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
    console.error("parse-vocab-paste error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
