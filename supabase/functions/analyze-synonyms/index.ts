import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEED_VOCABULARY = new Set([
  "derive","interpret","indicate","assume","maintain","imply","demonstrate",
  "reveal","perceive","emphasize","recognize","justify","evaluate","conclude",
  "hypothesis","evidence","framework","mechanism","dimension","perspective",
  "factor","implication","context","structure","interaction","principle",
  "analysis","significance","accountability","responsibility","distinction",
  "restrict","influence","essential","valid","objective","plausible",
  "intuition","compassion","empathy","activate","adapt","recover","protocol",
  "dissemination","democratization","engagement","accountable","construct",
  "process","perception","shift"
]);

const STOP_VOCABULARY = new Set([
  "thing","people","way","kind","good","many","make","use","house","person",
  "someone","something","anything","everything"
]);

function extractEnglishHeadword(raw: string): string {
  return raw.replace(/\s*\(.*$/, "").trim().toLowerCase();
}

function parseMarkdownTable(raw: string): { word: string; synonym: string; antonym: string }[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
  const dataLines = lines.filter((l) => !l.match(/^\|[\s\-:|]+\|$/));
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

function safeJsonParse(raw: string): any {
  const cleaned = String(raw ?? "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Failed to parse validator JSON");
  }
}

function splitCsvItems(raw: string): string[] {
  return String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function normalizeRowText(raw: string): string {
  return String(raw ?? "")
    .replace(/\(\(/g, "(")
    .replace(/\)\)/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

function hasGloss(item: string): boolean {
  return /\([^()]+\)/.test(String(item ?? ""));
}

function splitChipItems(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => normalizeRowText(s))
    .filter(Boolean);
}

function joinGlossedChipItems(raw: string): string {
  return splitChipItems(raw).filter(hasGloss).join(", ");
}

async function fillMissingChipGlossesWithAI(
  raw: string,
  passage: string,
  apiKey: string,
  fieldLabel: "synonym" | "antonym",
): Promise<string> {
  const items = splitChipItems(raw);
  if (!items.length || items.every(hasGloss)) return items.join(", ");

  const systemPrompt = `You are fixing EN-KO vocabulary chips for Korean high-school exam materials.

Task:
- Every item must be returned in the exact format: english (한국어뜻)
- Keep the original English chip text exactly if possible.
- Only fill in missing Korean glosses.
- If an item is low-quality or cannot be reliably glossed, drop it.
- Output ONLY JSON: {"items":["chip1(뜻)","chip2(뜻)"]}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.05,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            field: fieldLabel,
            passage,
            items,
          }),
        },
      ],
    }),
  });

  if (!response.ok) return joinGlossedChipItems(raw);

  try {
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeJsonParse(content);
    const fixed = Array.isArray(parsed?.items) ? parsed.items.map((x: any) => normalizeRowText(String(x ?? ""))).filter(Boolean) : [];
    const glossed = fixed.filter(hasGloss);
    return glossed.length ? glossed.join(", ") : joinGlossedChipItems(raw);
  } catch {
    return joinGlossedChipItems(raw);
  }
}

function applyCountPolicy(rows: { word: string; synonym: string; antonym: string }[]) {
  return rows
    .map((row) => {
      const syn = splitCsvItems(row.synonym).slice(0, 3);
      const ant = splitCsvItems(row.antonym).slice(0, 2);
      return {
        word: normalizeRowText(row.word),
        synonym: syn.join(", "),
        antonym: ant.join(", "),
      };
    })
    .filter((row) => !!row.word && splitCsvItems(row.synonym).length > 0);
}

async function validateRowsWithAI(
  rows: { word: string; synonym: string; antonym: string }[],
  passage: string,
  apiKey: string,
): Promise<{ word: string; synonym: string; antonym: string }[]> {
  if (!rows.length) return rows;

  const systemPrompt = `You are a strict bilingual EN-KO vocabulary QA reviewer for Korean high-school exam materials.

Task:
- Validate and correct EN-KO meaning alignment for each row.
- Fix wrong Korean glosses (example of wrong mapping: adverse=추앙하는).
- Keep part-of-speech and meaning consistency.
- Remove forced/unnatural synonym or antonym chips.

Output policy:
- For synonyms: default 3 high-quality chips. If a 3rd chip is forced/awkward, return 2.
- For antonyms: default 2 high-quality chips. If only one is natural, return 1.
- Every chip must keep the format: english (한국어뜻)
- English should be lowercase dictionary/base form when possible.
- Korean should be concise dictionary style.
- If a row is low quality overall, drop that row.

Output ONLY JSON:
{"rows":[{"word":"...", "synonym":"...", "antonym":"..."}]}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.05,
      max_tokens: 2200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ passage, rows }) },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("validator AI error:", response.status, errText);
    return rows;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = safeJsonParse(content);
    const validated = Array.isArray(parsed?.rows) ? parsed.rows : [];
    const normalized = validated
      .map((r: any) => ({
        word: normalizeRowText(String(r?.word ?? "")),
        synonym: normalizeRowText(String(r?.synonym ?? "")),
        antonym: normalizeRowText(String(r?.antonym ?? "")),
      }))
      .filter((r: any) => r.word && r.synonym);

    return await Promise.all(
      normalized.map(async (row: any) => ({
        ...row,
        synonym: await fillMissingChipGlossesWithAI(row.synonym, passage, apiKey, "synonym"),
        antonym: await fillMissingChipGlossesWithAI(row.antonym, passage, apiKey, "antonym"),
      }))
    ).then((rows) => rows.filter((r: any) => r.word && r.synonym));
  } catch (e) {
    console.error("validator parse error:", e);
    return rows;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passage } = await req.json();
    if (!passage) throw new Error("Missing passage");

    const trimmedPassage = String(passage || "").slice(0, 5000);

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
- Provide 3 synonyms by default.
- If a 3rd synonym is forced/unnatural, provide 2.
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
Before producing the final table, remove vocabulary that would be unrealistic for synonym or antonym questions in Korean high school exams.
Also verify EN-KO meaning alignment strictly and never output mistranslations.`;

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
          { role: "user", content: trimmedPassage },
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

    // Parse and post-process
    let synonyms = parseMarkdownTable(content);

    // 2nd-pass QA to catch mistranslations and enforce quality policy.
    synonyms = await validateRowsWithAI(synonyms, trimmedPassage, LOVABLE_API_KEY);
    synonyms = applyCountPolicy(synonyms);

    // Filter out STOP_VOCABULARY
    synonyms = synonyms.filter((item) => {
      const hw = extractEnglishHeadword(item.word);
      return !STOP_VOCABULARY.has(hw);
    });

    // Sort: SEED_VOCABULARY words first
    synonyms = synonyms.sort((a, b) => {
      const aIsSeed = SEED_VOCABULARY.has(extractEnglishHeadword(a.word)) ? 0 : 1;
      const bIsSeed = SEED_VOCABULARY.has(extractEnglishHeadword(b.word)) ? 0 : 1;
      return aIsSeed - bIsSeed;
    });

    // Limit to 10
    synonyms = synonyms.slice(0, 10);

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
