import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function countTags(tagged: string): number {
  return (tagged.match(/<c\d+>/g) || []).length;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentence, preset } = await req.json();
    if (!sentence || !preset) {
      return new Response(JSON.stringify({ error: "Missing sentence or preset" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const levelGuide = {
      "고1": "Use simple vocabulary appropriate for Korean high school 1st year English learners.",
      "고2": "Use intermediate vocabulary appropriate for Korean high school 2nd year English learners.",
      "수능": "Use vocabulary and complexity appropriate for Korean CSAT (수능) English exam level.",
    }[preset] || "";

    const systemPrompt = `You are a precise English-Korean sentence analysis engine. ${levelGuide}

Given an English sentence, you must:
1. Break the English sentence into meaningful chunks (phrases/clauses). Tag each chunk with <c1>, <c2>, etc.
2. Translate each chunk into Korean literally, preserving the EXACT same tag structure. Each tagged Korean segment must correspond to the same-numbered English tag.
3. Provide a natural Korean translation (no tags, prioritize readability).

CRITICAL RULES:
- The number of tags in english_tagged MUST equal the number of tags in korean_literal_tagged.
- Each <cN>...</cN> in English maps to exactly one <cN>...</cN> in Korean literal.
- Chunks should be meaning units: noun phrases, verb phrases, prepositional phrases, clauses.
- Do NOT split articles from their nouns.
- Natural Korean ignores tags entirely and reads naturally.
- EVERY word in the original sentence MUST appear in exactly one chunk. No word may be omitted.
- Conjunctions (while, but, although, because, however, etc.) MUST be included as part of a chunk, never dropped.
- Concatenating all english chunks (removing tags) must reconstruct the original sentence exactly.

You MUST respond by calling the "analysis_result" function with the structured output.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "analysis_result",
          description: "Return the chunked analysis of the sentence",
          parameters: {
            type: "object",
            properties: {
              english_tagged: {
                type: "string",
                description: "English sentence with <c1>...</c1> <c2>...</c2> tags around each chunk",
              },
              korean_literal_tagged: {
                type: "string",
                description: "Korean literal translation with the same <c1>...</c1> <c2>...</c2> tag structure",
              },
              korean_natural: {
                type: "string",
                description: "Natural Korean translation without any tags",
              },
            },
            required: ["english_tagged", "korean_literal_tagged", "korean_natural"],
            additionalProperties: false,
          },
        },
      },
    ];

    const MAX_ATTEMPTS = 3;
    let lastResult = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const messages: { role: string; content: string }[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this sentence: "${sentence}"` },
      ];

      if (attempt > 0 && lastResult) {
        messages.push({
          role: "user",
          content: `Your previous result had ${countTags(lastResult.english_tagged)} English chunks but ${countTags(lastResult.korean_literal_tagged)} Korean chunks. The counts MUST match exactly. Please redo the analysis carefully, ensuring every English chunk has a corresponding Korean chunk with the same tag number.`,
        });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools,
          tool_choice: { type: "function", function: { name: "analysis_result" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Credits exhausted. Please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call in response");

      lastResult = JSON.parse(toolCall.function.arguments);

      const enCount = countTags(lastResult.english_tagged);
      const krCount = countTags(lastResult.korean_literal_tagged);

      if (enCount === krCount) {
        console.log(`Chunk validation passed on attempt ${attempt + 1} (${enCount} chunks)`);
        break;
      }

      console.warn(`Attempt ${attempt + 1}: tag mismatch (en=${enCount}, kr=${krCount}), ${attempt < MAX_ATTEMPTS - 1 ? "retrying..." : "using last result"}`);
    }

    const toSlash = (tagged: string) =>
      tagged.replace(/<c\d+>/g, "").replace(/<\/c\d+>/g, " / ").replace(/ \/ $/, "").trim();

    return new Response(
      JSON.stringify({
        english_tagged: lastResult!.english_tagged,
        korean_literal_tagged: lastResult!.korean_literal_tagged,
        english_slash: toSlash(lastResult!.english_tagged),
        korean_literal_slash: toSlash(lastResult!.korean_literal_tagged),
        korean_natural: lastResult!.korean_natural,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
