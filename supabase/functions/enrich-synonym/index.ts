import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word, existingSynonyms, existingAntonyms, passage } = await req.json();
    if (!word) throw new Error("Missing word");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const trimmedPassage = String(passage || "").slice(0, 5000);
    const isNewWord = !existingSynonyms && !existingAntonyms;

    const systemPrompt = `You are a Korean high school English exam vocabulary expert.

Given a word (which may be a single word, phrasal verb, or idiomatic expression) and its existing synonyms/antonyms, generate ADDITIONAL synonyms and antonyms that are NOT already listed.

Rules:
- Every word must include a Korean meaning in parentheses, e.g. identify(확인하다)
- Generate 3 additional synonyms by default
- If the 3rd synonym is forced/unnatural, generate 2 synonyms
- Generate 2 additional antonyms by default (or 1 if only one natural opposite exists)
- Do NOT repeat any existing entries
- Keep the same part of speech as the original word
- Prefer common academic synonyms used in Korean high school exams
- Antonyms must represent meaningful conceptual opposites
- Never output incorrect EN-KO mappings (e.g., adverse=추앙하는 is invalid)
- For phrasal verbs or idioms (e.g. "turn down", "take up"), treat them as a single unit

Output ONLY valid JSON (no markdown, no explanation):
{"word_ko": "한국어 뜻", "synonyms": "word1(뜻1), word2(뜻2)", "antonyms": "word1(뜻1), word2(뜻2)"}

The "word_ko" field must contain the Korean meaning of the given word in the context of the passage.`;

    const userMessage = `Word: ${word}
Existing synonyms: ${existingSynonyms || "(none)"}
Existing antonyms: ${existingAntonyms || "(none)"}
${trimmedPassage ? `\nPassage context:\n${trimmedPassage}` : ""}`;

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
          { role: "user", content: userMessage },
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

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse JSON from response");

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({
      word_ko: result.word_ko || "",
      synonyms: result.synonyms || "",
      antonyms: result.antonyms || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-synonym error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
