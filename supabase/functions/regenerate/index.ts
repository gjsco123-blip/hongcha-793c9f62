import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function sanitizeKorean(text: string): string {
  return text
    .replace(/했습니다/g, '했다')
    .replace(/됩니다/g, '된다')
    .replace(/되었습니다/g, '되었다')
    .replace(/됐습니다/g, '됐다')
    .replace(/있습니다/g, '있다')
    .replace(/없습니다/g, '없다')
    .replace(/갑니다/g, '간다')
    .replace(/옵니다/g, '온다')
    .replace(/줍니다/g, '준다')
    .replace(/봅니다/g, '본다')
    .replace(/납니다/g, '난다')
    .replace(/겁니다/g, '것이다')
    .replace(/습니까/g, '는가')
    .replace(/합니다/g, '한다')
    .replace(/입니다/g, '이다');
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { english_tagged } = await req.json();
    if (!english_tagged) {
      return new Response(JSON.stringify({ error: "Missing english_tagged" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a precise English-Korean literal translation engine.

You will receive an English sentence with chunk tags like <c1>...</c1>, <c2>...</c2>, etc.

Your job:
1. Translate each tagged chunk literally into Korean, keeping the EXACT same tag structure.
2. The number and order of tags must be preserved exactly.
3. Each <cN>...</cN> in Korean must correspond to the same <cN>...</cN> in English.
4. CRITICAL: Use INFORMAL Korean endings (반말). Use ~했다, ~이다, ~한다, ~였다, ~된다. NEVER use polite endings like ~합니다, ~입니다, ~했습니다, ~됩니다.

You MUST respond by calling the "regenerate_result" function.`;

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
          { role: "user", content: `Translate this tagged English into Korean literal, preserving tags:\n${english_tagged}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "regenerate_result",
              description: "Return the regenerated Korean literal translation",
              parameters: {
                type: "object",
                properties: {
                  korean_literal_tagged: {
                    type: "string",
                    description: "Korean literal translation preserving the exact same tag structure",
                  },
                },
                required: ["korean_literal_tagged"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "regenerate_result" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const result = JSON.parse(toolCall.function.arguments);

    const toSlash = (tagged: string) =>
      tagged.replace(/<c\d+>/g, "").replace(/<\/c\d+>/g, " / ").replace(/ \/ $/, "").trim();

    return new Response(
      JSON.stringify({
        korean_literal_tagged: sanitizeKorean(result.korean_literal_tagged),
        korean_literal_slash: toSlash(sanitizeKorean(result.korean_literal_tagged)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("regenerate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
