import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function countTags(tagged: string): number {
  return (tagged.match(/<c\d+>/g) || []).length;
}

function getTagNumbers(tagged: string): number[] {
  return [...tagged.matchAll(/<c(\d+)>/g)].map(m => Number(m[1])).sort((a, b) => a - b);
}

function extractText(tagged: string): string {
  return tagged.replace(/<\/?c\d+>/g, "").replace(/<\/?v>/g, "").replace(/<\/?s>/g, "");
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

    const levelGuide = ({
      "고1": "Use simple vocabulary appropriate for Korean high school 1st year English learners.",
      "고2": "Use intermediate vocabulary appropriate for Korean high school 2nd year English learners.",
      "수능": "Use vocabulary and complexity appropriate for Korean CSAT (수능) English exam level.",
    } as Record<string, string>)[preset] || "";

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
- **Contracted verbs**: 's (= is/has), 're (= are), 've (= have), 'd (= would/had), 'll (= will) are finite verbs and MUST be tagged.
  - CORRECT: there<v>'s</v> no reason → 's = is = finite verb
  - CORRECT: they<v>'ve discovered</v> → 've = have = finite verb
  - CORRECT: it<v>'ll change</v> → 'll = will = finite verb
  - WRONG: there's no reason → missing <v> tag on 's
  - **EXCEPTION**: "let's" = "let us" → 's is NOT a verb here. Tag "let" instead: <v>let</v>'s follow.
- **Negative contractions**: isn't, don't, won't, can't, doesn't, hasn't, hadn't, wouldn't, couldn't, shouldn't, aren't, weren't, wasn't, mustn't — these are SINGLE verb units. Tag the ENTIRE word as one <v> block.
  - CORRECT: it <v>isn't</v> easy
  - WRONG: it <v>is</v>n't easy
  - CORRECT: they <v>don't</v> know
  - WRONG: they <v>do</v>n't know

### NEVER tag these — they are NOT verbs:
1. **To-infinitives**: "to cause", "to achieve", "to engage", "to switch off" → NO <v> tag. The word "to" before a verb = infinitive = NOT a finite verb.
2. **Gerunds (-ing as noun)**: "Swimming is fun" → "Swimming" is a noun, not a verb.
3. **Participles as adjectives**: "the broken window", "an interesting book" → adjectives, not verbs.
4. **Prepositions/conjunctions that look like verbs**: such as, as well as, rather than, according to, due to, because of, in order to, as opposed to, in addition to, regardless of, in terms of, based on, depending on.
5. **Adjectives/complements after linking verbs**: In "X is effective", "is" is the verb → <v>is</v>. "effective" is an adjective complement → NO <v> tag. Same for: important, necessary, possible, difficult, useful, essential, significant, available, responsible, aware, capable, likely, etc.
   - CORRECT: control <v>is</v> sometimes effective → only "is" gets <v>
   - WRONG: control <v>is</v> sometimes <v>effective</v> → "effective" is NOT a verb
   - CORRECT: it <v>is</v> important to note → only "is" gets <v>
   - WRONG: it <v>is</v> <v>important</v> to note
6. **Reduced adverbial clauses (분사구문/축약절)**: Past participles after conjunctions like "when", "once", "if", "while", "although", "though", "unless" where "subject + be" is omitted.
   - "when asked" = "when [they are] asked" → "asked" is a participle, NOT a finite verb → NO <v>
   - "once completed" = "once [it is] completed" → NO <v>
   - "if given the chance" → NO <v> on "given"
   - "while surrounded by" → NO <v> on "surrounded"
   - CORRECT: when asked to recall → NO <v> on "asked"
   - WRONG: when <v>asked</v> to recall
   - **Test**: Can you insert "[subject] + [be verb]" between the conjunction and participle? If YES → it's a reduced clause → NO <v>.

### Examples:
- CORRECT: <c1>The ability to cause harm</c1> → "to cause" has NO <v> tag
- WRONG:  <c1>The ability <v>to cause</v> harm</c1>
- CORRECT: <c2>researchers <v>studied</v> the effects</c2>
- WRONG:  <c2>researchers <v>such as</v> Boas</c2> — "such as" is a preposition
- CORRECT: <c3>which <v>can lead</v> to problems</c3> → "can lead" is finite, "to" after it is a preposition
- CORRECT: <c4>Upon encountering the data,</c4> → "Upon" is a preposition, "encountering" is a gerund — NO <v>

### Quick test: Ask "Does this word have a SUBJECT performing it RIGHT HERE in this clause?" If NO → do NOT use <v>.

## SUBJECT TAGGING — TAG WITH <s>...</s>

Tag the **head noun phrase (NP)** that serves as the grammatical subject (수일치의 핵) with <s>...</s>.

### What to include in <s>:
- **Determiner + pre-modifiers + head noun ONLY**. Examples:
  - "<s>The new students</s> are confronted..." (include "The new" and head "students")
  - "<s>students</s>" (bare plural, no determiner)
  - "<s>John and Mary</s>" (coordinated subject — wrap the whole NP)
- **Subordinate clause subjects also get <s>**: "Because <s>the rain</s> stopped, <s>we</s> went out"
- **Expletive It (가주어)**: "<s>It</s> is important that..." → tag "It" as <s>
- **There/Here + be + NP**: 'there/here' is NOT the subject. Tag the **NP after the verb** as <s>.
  - "There are <s>many students</s>" (NOT <s>there</s>)
  - "Here are <s>the books</s> I bought" (relative clause "I bought" excluded)

### What to EXCLUDE from <s>:
- **Post-modifiers** (전치사구/관계절/분사구/동격): "<s>The students</s> from Seoul who passed are..." — exclude "from Seoul who passed"
- **Parentheticals/insertions** (콤마로 분리된 삽입구): "<s>The students</s>, however, are confused" — "however" is OUTSIDE <s>
- Adverbs and conjunctions

### CRITICAL constraint:
- <v> and <s> tags MUST NEVER overlap or nest. They are always **adjacent** (with optional whitespace/text between).
- WRONG: <s>The <v>students</v></s>  ← never nest
- WRONG: <s>The students <v>are</v></s>  ← never nest
- CORRECT: <s>The students</s> <v>are</v>

### Examples:
- <c1><s>The new students</s></c1> <c2><v>are</v> now <v>confronted</v> with...</c2>
- <c1>Because <s>the rain</s> <v>stopped</v>,</c1> <c2><s>we</s> <v>went out</v></c2>
- <c1><s>The students</s>, however,</c1> <c2><v>are</v> confused</c2>
- <c1><s>It</s> <v>is</v> important</c1> <c2>that <s>he</s> <v>arrived</v></c2>
- <c1>There <v>are</v> <s>many students</s></c1> <c2>from Seoul</c2>
- <c1><s>John and Mary</s> <v>are</v> friends</c1>

### NEVER tag these as <s> — these are NOT subjects:
1. **Direct objects** (동사 뒤 명사구는 기본적으로 목적어). After a transitive verb, the NP that follows is the object, NOT the subject.
   - WRONG: <s>The policy</s> <v>allows</v> <s>citizens</s> to retain freedom  ← "citizens" is the OBJECT
   - CORRECT: <s>The policy</s> <v>allows</v> citizens to retain freedom
2. **Indirect objects**: "She <v>gave</v> him a book" → "him" and "a book" are objects, NOT <s>.
3. **Object complements**: "They <v>elected</v> her president" → "her" and "president" are NOT <s>.
4. **Subject complements** (linking verb 뒤의 보어): "<s>He</s> <v>is</v> a teacher" → "a teacher" is a complement, NOT <s>.
   - WRONG: <s>He</s> <v>is</v> <s>a teacher</s>
   - CORRECT: <s>He</s> <v>is</v> a teacher
5. **Objects of prepositions**: "<s>The book</s> <v>is</v> on the table" → "the table" is NOT <s>.
6. **Nouns inside infinitive phrases**: "<s>I</s> <v>want</v> to read the book" → "the book" is NOT <s>.
7. **Nouns inside participial phrases**: "<v>holding</v> the umbrella" → "the umbrella" is NOT <s>.
8. **Post-modifiers of the subject**: relative clauses, prepositional phrases, and participial phrases that follow the head noun are NOT part of <s>.
   - WRONG: <s>The students who passed the exam</s> <v>are</v> happy
   - CORRECT: <s>The students</s> who <v>passed</v> the exam <v>are</v> happy
   - WRONG: <s>The balance of power</s> <v>shifted</v>  (when "of power" is post-modifier — only if it's the actual subject NP)
     Note: if "of power" is restrictive part of subject head, include it; but in "<v>has shifted</v> the balance of power", "the balance of power" is the OBJECT.

### Strong negative few-shot examples (MEMORIZE):
- "The policy allows citizens to retain freedom"
  - CORRECT: <c1><s>The policy</s> <v>allows</v> citizens</c1> <c2>to retain freedom</c2>
  - WRONG:   <c1><s>The policy</s> <v>allows</v> <s>citizens</s></c1> <c2>to retain <s>freedom</s></c2>
- "Technology has shifted the balance of power"
  - CORRECT: <c1><s>Technology</s> <v>has shifted</v></c1> <c2>the balance of power</c2>
  - WRONG:   <c1><s>Technology</s> <v>has shifted</v></c1> <c2><s>the balance of power</s></c2>
- "The democratization of technology will not solve the problem"
  - CORRECT: <c1><s>The democratization of technology</s> <v>will not solve</v></c1> <c2>the problem</c2>
  - WRONG:   <c1><s>The democratization of technology</s> <v>will not solve</v> <s>the problem</s></c1>
- "She is a doctor"
  - CORRECT: <c1><s>She</s> <v>is</v> a doctor</c1>
  - WRONG:   <c1><s>She</s> <v>is</v> <s>a doctor</s></c1>
- "He gave her a present"
  - CORRECT: <c1><s>He</s> <v>gave</v> her a present</c1>
  - WRONG:   <c1><s>He</s> <v>gave</v> <s>her</s> <s>a present</s></c1>

### Decision rule before tagging any NP as <s>:
Ask: "Does THIS exact NP perform a finite verb that comes AFTER it (or is right next to it as a clause subject)?"
- If YES → <s>
- If it sits AFTER a finite verb in the same clause → it's the OBJECT or COMPLEMENT → NO <s>
- If it's inside a prepositional/infinitive/participial phrase → NO <s>

### Per-clause limit:
- Each finite clause has **exactly ONE** subject NP. Never tag two <s> in the same clause.

## CHUNKING RULES
- Tag count in english_tagged MUST equal tag count in korean_literal_tagged.
- Each <cN> in English maps to exactly one <cN> in Korean.
- CRITICAL: <c1> in english_tagged MUST correspond to <c1> in korean_literal_tagged, <c2> to <c2>, etc. Each numbered chunk must translate the SAME phrase boundary. Do NOT merge or split chunks differently between English and Korean.
- Chunks = meaning units: noun phrases, verb phrases, prepositional phrases, clauses.
- Do NOT split articles from their nouns.
- EVERY word and punctuation mark MUST appear in exactly one chunk — nothing omitted.
- ALL punctuation preserved exactly: dashes (—, –, -), commas, semicolons, colons, parentheses, quotes.
- Conjunctions (while, but, although, because, however) MUST be included in a chunk, never dropped.
- Concatenating all chunks (removing tags) MUST reconstruct the original sentence exactly.
- <v> tags go INSIDE <c> tags: <c1>The researchers <v>discovered</v></c1>
- <s> tags go INSIDE <c> tags, never overlapping with <v>.

## KOREAN TRANSLATION RULES
- NEVER use Chinese characters (漢字/Hanja) in Korean translations.
- Write all Korean in pure Hangul only.
- Do NOT add parenthetical Hanja explanations like 현현(顯現).
- Use simple, natural Korean words appropriate for middle/high school students.
- 직역(korean_literal_tagged)과 의역(korean_natural) 모두 반말 종결(~했다, ~이다, ~한다, ~였다)로 통일할 것.
- 금지 패턴: ~합니다, ~됩니다, ~했습니다, ~입니다 (존댓말 금지)
- Good 직역: "연구자들은 그 효과를 연구했다"
- Bad 직역: "연구자들은 그 효과를 연구했습니다"
- Good 의역: "이 실험은 보상이 의사결정에 미치는 영향을 보여준다"
- Bad 의역: "이 실험은 보상이 의사결정에 미치는 영향을 보여줍니다"

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

      const enTags = getTagNumbers(lastResult.english_tagged);
      const krTags = getTagNumbers(lastResult.korean_literal_tagged);
      const tagMatch = JSON.stringify(enTags) === JSON.stringify(krTags);
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
        if (!tagMatch) feedback.push(`Tag number mismatch: English tags [${enTags}] vs Korean tags [${krTags}]. Each <cN> in English must have a corresponding <cN> in Korean.`);
        if (!contentMatch) feedback.push(`Your chunks are missing words. Original: "${original}" but your chunks give: "${reconstructed}". EVERY word must appear in exactly one chunk.`);
        messages.push({ role: "user", content: feedback.join(" ") + " Please redo carefully." });
      } else {
        console.warn("Max attempts reached, using last result.");
      }
    }

    // === Korean literal repair pass (if tag numbers still mismatched) ===
    const finalEnTags = getTagNumbers(lastResult!.english_tagged);
    const finalKrTags = getTagNumbers(lastResult!.korean_literal_tagged);
    if (JSON.stringify(finalEnTags) !== JSON.stringify(finalKrTags)) {
      console.log("Tag number mismatch after retries, attempting Korean literal repair...");
      try {
        const repairPrompt = `You are a precise English-Korean literal translation engine.

The English sentence has been chunked as follows:
${lastResult!.english_tagged}

Your job: Translate each chunk into Korean literally, using the EXACT SAME tag structure.
- Use the same <cN>...</cN> tag numbers as the English.
- Preserve <v>...</v> tags inside chunks — just translate the text around them.
- Use informal Korean endings (반말): ~했다, ~이다, ~한다, ~였다.
- NEVER use polite endings: ~합니다, ~입니다, ~했습니다.
- NEVER use Chinese characters (Hanja).

Return ONLY the Korean tagged string. Nothing else.`;

        const repairResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + LOVABLE_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: repairPrompt },
              { role: "user", content: lastResult!.english_tagged },
            ],
          }),
        });

        if (repairResponse.ok) {
          const repairData = await repairResponse.json();
          const repaired = repairData.choices?.[0]?.message?.content?.trim();
          if (repaired) {
            let cleanedRepair = repaired.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
            // Remove <v> tags from Korean (Korean doesn't use verb tags)
            cleanedRepair = cleanedRepair.replace(/<\/?v>/g, '').replace(/<\/?s>/g, '');
            const repairedTags = getTagNumbers(cleanedRepair);
            if (JSON.stringify(finalEnTags) === JSON.stringify(repairedTags)) {
              console.log("Korean literal repair successful");
              lastResult!.korean_literal_tagged = sanitizeKorean(cleanedRepair);
            } else {
              console.warn("Korean literal repair failed: tags still mismatched", repairedTags, "vs", finalEnTags);
            }
          }
        }
      } catch (repairErr) {
        console.warn("Korean literal repair failed:", repairErr);
      }
    }

    // === Verb tag verification pass ===
    try {
      const verbVerifyPrompt = `You are a precise English grammar verb-tagging verifier.

Given an English sentence that has been chunked with <c1>...</c1>, <c2>...</c2> tags and verb-tagged with <v>...</v> tags, your job is to VERIFY and CORRECT ONLY the <v> tags.

## ABSOLUTE RULES:
1. DO NOT change the <cN>...</cN> structure in any way — same tags, same boundaries, same text.
2. DO NOT change the text content at all — no word additions, removals, or reordering.
3. ONLY add, remove, or adjust <v>...</v> tags.
4. PRESERVE all <s>...</s> tags exactly as they are. Do NOT remove, add, or modify them.

## What MUST have <v> tags (finite verbs only):
- Simple finite verbs: <v>discovered</v>, <v>is</v>, <v>runs</v>
- Auxiliary + main verb: <v>has been working</v>, <v>were conducted</v>
- Modal + verb: <v>can affect</v>, <v>should consider</v>
- Multi-word verbs: <v>sought out</v>, <v>turned off</v>
- Contracted verbs: 's (= is/has), 're (= are), 've (= have), 'd (= would/had), 'll (= will)
  - CORRECT: there<v>'s</v> no reason
  - EXCEPTION: "let's" = "let us" → 's is NOT a verb. Tag: <v>let</v>'s
- Negative contractions (isn't, don't, won't, can't, doesn't, hasn't, hadn't, wouldn't, couldn't, shouldn't, aren't, weren't, wasn't, mustn't) are SINGLE verb units. Tag entire word: <v>isn't</v>, <v>don't</v>
  - CORRECT: it <v>isn't</v> easy
  - WRONG: it <v>is</v>n't easy

## What MUST NOT have <v> tags:
1. To-infinitives: "to cause", "to achieve" → NO <v>
2. Gerunds as nouns: "Swimming is fun" → "Swimming" = noun
3. Participles as adjectives: "the broken window", "an interesting book"
4. Prepositions/conjunctions: such as, as well as, rather than, according to, due to, because of, in order to, as opposed to, in addition to, regardless of, in terms of, based on, depending on
5. Adjective complements after linking verbs: In "X is effective", only "is" gets <v>. "effective" does NOT.
   - CORRECT: <v>is</v> sometimes effective
   - WRONG: <v>is</v> sometimes <v>effective</v>
6. Reduced adverbial clauses (분사구문/축약절): Past participles after conjunctions like "when", "once", "if", "while", "although", "though", "unless" where "subject + be" is omitted.
   - "when asked" = "when [they are] asked" → NO <v> on "asked"
   - "once completed" = "once [it is] completed" → NO <v>
   - CORRECT: when asked to recall → NO <v> on "asked"
   - WRONG: when <v>asked</v> to recall

## Quick test: "Does this word have a SUBJECT performing it RIGHT HERE in this clause?" If NO → no <v>.

Return ONLY the corrected english_tagged string. Nothing else.`;

      const verifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: verbVerifyPrompt },
            { role: "user", content: lastResult!.english_tagged },
          ],
        }),
      });

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const verified = verifyData.choices?.[0]?.message?.content?.trim();
        if (verified) {
          // Strip markdown code block wrappers if present
          let cleaned = verified.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();

          // Safety check: ensure text content is unchanged
          const verifiedText = normalize(extractText(cleaned));
          const originalText = normalize(extractText(lastResult!.english_tagged));
          const origVCount = (lastResult!.english_tagged.match(/<v>/g) || []).length;
          const newVCount = (cleaned.match(/<v>/g) || []).length;

          if (verifiedText === originalText) {
            if (origVCount > 0 && newVCount === 0) {
              console.warn("Verb verification: all <v> tags stripped, discarding");
            } else if (origVCount > 0 && newVCount < origVCount * 0.5) {
              console.warn("Verb verification: too many <v> tags lost, discarding");
            } else if (cleaned !== lastResult!.english_tagged) {
              console.log("Verb verification: corrected <v> tags");
              lastResult!.english_tagged = cleaned;
            } else {
              console.log("Verb verification: no changes needed");
            }
          } else {
            console.warn("Verb verification: text content changed, discarding correction");
          }
        }
      }
    } catch (verifyErr) {
      console.warn("Verb verification failed, using original:", verifyErr);
    }

    const toSlash = (tagged: string) =>
      tagged.replace(/<c\d+>/g, "").replace(/<\/c\d+>/g, " / ").replace(/ \/ $/, "").trim();

    return new Response(
      JSON.stringify({
        english_tagged: lastResult!.english_tagged,
        korean_literal_tagged: sanitizeKorean(lastResult!.korean_literal_tagged),
        english_slash: toSlash(lastResult!.english_tagged),
        korean_literal_slash: toSlash(sanitizeKorean(lastResult!.korean_literal_tagged)),
        korean_natural: sanitizeKorean(lastResult!.korean_natural),
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
