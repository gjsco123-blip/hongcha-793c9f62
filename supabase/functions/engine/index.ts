import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function countTags(tagged: string): number {
  return (tagged.match(/<c\d+>/g) || []).length;
}

function extractText(tagged: string): string {
  return tagged.replace(/<\/?c\d+>/g, "").replace(/<\/?v>/g, "");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Repair tagged string by ensuring all text from original sentence is captured in chunks */
function repairTagged(tagged: string, original: string): string {
  const extracted = normalize(extractText(tagged));
  const norm = normalize(original);
  if (extracted === norm) return tagged;

  // Find missing trailing text
  if (norm.startsWith(extracted)) {
    const missing = norm.substring(extracted.length).trim();
    if (missing) {
      // Append missing text to the last chunk
      const lastClose = tagged.lastIndexOf("</c");
      if (lastClose !== -1) {
        const closeEnd = tagged.indexOf(">", lastClose) + 1;
        const beforeClose = tagged.substring(0, lastClose);
        const closeTag = tagged.substring(lastClose, closeEnd);
        const after = tagged.substring(closeEnd);
        return beforeClose + " " + missing + closeTag + after;
      }
    }
  }

  // Strip residual malformed tags from tagged content
  const cleaned = tagged.replace(/<c\d+>|<\/c\d+>/g, (m, offset) => {
    // Keep properly paired tags, remove orphans
    return m;
  });

  return tagged;
}

function safeParseJson(raw: string): Record<string, string> {
  // Try direct parse first
  try { return JSON.parse(raw); } catch { /* fallback */ }

  // Strip markdown wrappers if present
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Find JSON boundaries
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
    try { return JSON.parse(cleaned); } catch { /* fallback */ }
  }

  // Try repairing truncated JSON by closing open braces
  if (start !== -1) {
    let repaired = cleaned.substring(start);
    // Remove trailing comma or incomplete value
    repaired = repaired.replace(/,\s*$/, "").replace(/:\s*"[^"]*$/, ': ""');
    let braces = 0;
    for (const ch of repaired) { if (ch === "{") braces++; if (ch === "}") braces--; }
    while (braces > 0) { repaired += "}"; braces--; }
    try { return JSON.parse(repaired); } catch { /* give up */ }
  }

  throw new Error("Failed to parse AI response as JSON");
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
1. Break it into meaningful chunks (phrases/clauses). Tag each with <c1>, <c2>, etc.
2. Translate each chunk into Korean literally with the EXACT same tag structure.
3. Provide a natural Korean translation (no tags).

## VERB TAGGING — READ THIS FIRST

### What to tag with <v>...</v>:
ONLY finite verbs — verbs that serve as the predicate of a clause with a subject.
- Simple verbs: <v>discovered</v>, <v>is</v>, <v>runs</v>
- Auxiliary + main: <v>has been working</v>, <v>were conducted</v>
- Modal + verb: <v>can affect</v>, <v>should consider</v>
- Multi-word verbs in ONE tag: <v>sought out</v>, <v>turned off</v>

### NEVER tag these — they are NOT verbs:
1. **To-infinitives**: "to cause", "to achieve", "to engage", "to switch off" → NO <v> tag. The word "to" before a verb = infinitive = NOT a finite verb.
2. **Gerunds (-ing as noun)**: "Swimming is fun" → "Swimming" is a noun, not a verb.
3. **Participles as adjectives**: "the broken window", "an interesting book" → adjectives, not verbs.
4. **Prepositions/conjunctions that look like verbs**: such as, as well as, rather than, according to, due to, because of, in order to, as opposed to, in addition to, regardless of, in terms of, based on, depending on.

### Examples:
- CORRECT: <c1>The ability to cause harm</c1> → "to cause" has NO <v> tag
- WRONG:  <c1>The ability <v>to cause</v> harm</c1>
- CORRECT: <c2>researchers <v>studied</v> the effects</c2>
- WRONG:  <c2>researchers <v>such as</v> Boas</c2> — "such as" is a preposition
- CORRECT: <c3>which <v>can lead</v> to problems</c3> → "can lead" is finite, "to" after it is a preposition
- CORRECT: <c4>Upon encountering the data,</c4> → "Upon" is a preposition, "encountering" is a gerund — NO <v>

### Quick test: Ask "Does this word have a SUBJECT performing it RIGHT HERE in this clause?" If NO → do NOT use <v>.

## CHUNKING RULES
- Tag count in english_tagged MUST equal tag count in korean_literal_tagged.
- Each <cN> in English maps to exactly one <cN> in Korean.
- Chunks = meaning units: noun phrases, verb phrases, prepositional phrases, clauses.
- Do NOT split articles from their nouns.
- EVERY word and punctuation mark MUST appear in exactly one chunk — nothing omitted.
- ALL punctuation preserved exactly: dashes (—, –, -), commas, semicolons, colons, parentheses, quotes.
- Conjunctions (while, but, although, because, however) MUST be included in a chunk, never dropped.
- Concatenating all chunks (removing tags) MUST reconstruct the original sentence exactly.
- <v> tags go INSIDE <c> tags: <c1>The researchers <v>discovered</v></c1>

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
                description: "English sentence with <c1>...</c1> <c2>...</c2> tags around each chunk. Main verbs within chunks are wrapped with <v>...</v> tags.",
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
          model: "google/gemini-2.5-flash",
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

      try {
        lastResult = safeParseJson(toolCall.function.arguments);
      } catch (parseErr) {
        console.warn(`Attempt ${attempt + 1}: Failed to parse tool call arguments: ${toolCall.function.arguments?.substring(0, 200)}`);
        if (attempt >= MAX_ATTEMPTS - 1) throw parseErr;
        continue;
      }

      if (!lastResult.english_tagged || !lastResult.korean_literal_tagged || !lastResult.korean_natural) {
        console.warn(`Attempt ${attempt + 1}: Missing required fields in parsed result`);
        if (attempt >= MAX_ATTEMPTS - 1) throw new Error("AI returned incomplete fields after max attempts");
        continue;
      }

      const enCount = countTags(lastResult.english_tagged);
      const krCount = countTags(lastResult.korean_literal_tagged);

      const tagMatch = enCount === krCount;
      let reconstructed = normalize(extractText(lastResult.english_tagged));
      const original = normalize(sentence);
      let contentMatch = reconstructed === original;

      // Attempt auto-repair if content doesn't match
      if (!contentMatch) {
        lastResult.english_tagged = repairTagged(lastResult.english_tagged, sentence);
        reconstructed = normalize(extractText(lastResult.english_tagged));
        contentMatch = reconstructed === original;
        if (contentMatch) {
          console.log(`Auto-repaired english_tagged on attempt ${attempt + 1}`);
        }
      }

      if (tagMatch && contentMatch) {
        console.log(`Validation passed on attempt ${attempt + 1} (${enCount} chunks)`);
        break;
      }

      if (!tagMatch) {
        console.warn(`Attempt ${attempt + 1}: tag mismatch (en=${enCount}, kr=${krCount})`);
      }
      if (!contentMatch) {
        console.warn(`Attempt ${attempt + 1}: content mismatch.\nOriginal:      "${original}"\nReconstructed: "${reconstructed}"`);
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        // Add specific feedback for retry
        const feedback: string[] = [];
        if (!tagMatch) feedback.push(`Tag count mismatch: ${enCount} English vs ${krCount} Korean chunks.`);
        if (!contentMatch) feedback.push(`Your chunks are missing words. Original: "${original}" but your chunks give: "${reconstructed}". EVERY word must appear in exactly one chunk.`);
        messages.push({ role: "user", content: feedback.join(" ") + " Please redo carefully." });
      } else {
        console.warn("Max attempts reached, using last result.");
      }
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
