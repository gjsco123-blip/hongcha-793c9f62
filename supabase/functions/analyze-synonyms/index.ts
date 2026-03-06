import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseMarkdownTable(raw: string): { word: string; synonym: string; antonym: string }[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
  // Skip header and separator rows
  const dataLines = lines.filter((l) => !l.match(/^\|[\s\-:|]+\|$/));
  // Remove header row (first non-separator line that contains 단어/동의어/반의어)
  const filtered = dataLines.filter((l) => !/단어|동의어|반의어|word|synonym|antonym/i.test(l));

  return filtered.map((line) => {
    const cells = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
    return {
      word: cells[0] || "",
      synonym: cells[1] || "",
      antonym: cells[2] || "",
    };
  }).filter((item) => item.word);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a Korean high school English exam writer creating vocabulary questions for 내신 and CSAT-style exams.

Your task is to analyze the given English passage and extract vocabulary words that Korean high school teachers are most likely to select for synonym or antonym test questions.

Think from the perspective of a Korean high school exam writer.

The goal is NOT to list every difficult word.
The goal is to select realistic exam-target vocabulary.

--------------------------------------------------

OUTPUT FORMAT

Output ONLY a markdown table with the following columns:

| 단어 | 동의어 | 반의어 |

Rules:
- Every word must include a Korean meaning in parentheses.
- Synonyms and antonyms must also include Korean meanings.
- Do not include explanations outside the table.

Example:
| 단어 | 동의어 | 반의어 |
|---|---|---|
| recognize (인식하다) | identify(확인하다), acknowledge(인정하다) | ignore(무시하다) |

--------------------------------------------------

STEP 1 — CONCEPT WORD DETECTION

First identify key conceptual vocabulary representing the main ideas of the passage.

Focus on words expressing:
- core arguments
- reasoning
- scientific or social concepts
- cause-and-effect relationships
- evaluation or judgment

Prefer vocabulary central to the author's reasoning.

--------------------------------------------------

STEP 2 — VOCABULARY SELECTION

Select approximately 8–12 vocabulary items that Korean high school teachers would realistically use for synonym or antonym questions.

--------------------------------------------------

PART OF SPEECH PRIORITY

Prefer selecting:
1. Academic verbs
2. Abstract nouns
3. Conceptual adjectives

Avoid selecting:
- adverbs unless conceptually essential
- purely descriptive words
- overly concrete nouns unless they represent abstract ideas
- profession or role nouns unless conceptually important

Examples to avoid: journalist, publisher, teacher, worker

--------------------------------------------------

ACADEMIC VOCABULARY PRIORITY

Prefer abstract academic vocabulary often used in exam passages.

Examples of common academic verbs: derive, interpret, indicate, reveal, perceive, emphasize, assume, maintain, demonstrate

Examples of abstract nouns: factor, implication, dimension, perspective, framework, mechanism, principle, context, structure, interaction, hypothesis, evidence, accountability

--------------------------------------------------

STOP VOCABULARY FILTER

Avoid extremely common everyday words unless they are central concepts.
Examples: thing, people, way, kind, good, many, make, use

--------------------------------------------------

SYNONYM RULES
- Provide up to 3 synonyms.
- If natural synonyms are limited, provide 1–2.
- Synonyms must keep the same part of speech.
- Prefer common academic synonyms used in exams.
- Avoid extremely rare vocabulary.

--------------------------------------------------

ANTONYM RULES
- Provide up to 2 antonyms.
- If a clear antonym is unavailable, provide only 1.
- Antonyms must represent a meaningful conceptual opposite.
- Avoid forced opposites.

--------------------------------------------------

COMMON SYNONYM PATTERNS

recognize → identify
reveal → show
indicate → suggest
suggest → imply
explore → investigate
examine → analyze
emphasize → stress
significant → important
factor → element
limit → restrict
influence → affect

Use these patterns as guidance.

--------------------------------------------------

FINAL INSTRUCTION

Act as a Korean high school teacher writing vocabulary questions.
Before producing the final table, remove vocabulary that would be unrealistic for synonym or antonym questions in Korean high school exams.`;

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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in response");

    const synonyms = parseMarkdownTable(content);
    if (synonyms.length === 0) {
      console.error("Failed to parse markdown table from:", content);
      throw new Error("Failed to parse synonyms table");
    }

    return new Response(JSON.stringify({ synonyms }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-synonyms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
