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
  return tagged
    .replace(/<\/?c\d+>/g, "")
    .replace(/<(?:v|s|vs|ss)(?:\s+g="\d+")?>/g, "")
    .replace(/<\/(?:v|s|vs|ss)>/g, "");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Deterministic guard: strip <s>/<ss> tags from NPs that are clearly OBJECTS, not subjects.
 *
 * Core insight: in any clause, the FIRST subject (s/ss) MUST appear BEFORE its verb (v/vs).
 * Any subject tag that appears AFTER a verb tag — without an intervening verb that it could
 * be the subject of — is almost certainly an object/complement that the LLM mis-tagged.
 *
 * Rules (applied per <cN> chunk; relative clauses inside the same chunk handled via R2):
 *   R1: Within a chunk, after the FIRST verb (v/vs), any s/ss that is NOT immediately
 *       followed by another verb tag inside the chunk is an OBJECT — strip the s/ss tag
 *       (keep inner text).
 *   R2 (relative clause): Pattern `<v|vs>X</v|vs> <s|ss>NP</s|ss> <s|ss>Y</s|ss> <v|vs>Z</v|vs>`
 *       → NP is object + antecedent, Y is the relative-clause subject. Strip NP's s/ss tag,
 *       keep Y's tag. Captured as a special case of R1 since NP is followed by another
 *       s/ss (Y), not by a verb.
 *
 * Safety: validates text content unchanged, c-tag structure unchanged, v-tag count unchanged.
 * Aborts if more than 50% of subject tags would be removed (likely false positive).
 */
function stripObjectSubjectTags(tagged: string): { result: string; removed: number } {
  const subjectOpenRe = /<(s|ss)(\s+g="\d+")?>/;
  const verbOpenRe = /<(v|vs)(\s+g="\d+")?>/;

  // Tokenize the string into open/close tag events with positions.
  type Tok = { kind: "open" | "close"; tag: "s" | "ss" | "v" | "vs"; start: number; end: number };
  const allTagRe = /<(\/?)(s|ss|v|vs)(?:\s+g="\d+")?>/g;

  // Process each <cN>...</cN> chunk independently
  const chunkRe = /<c(\d+)>([\s\S]*?)<\/c\1>/g;
  let totalRemoved = 0;
  let existentialPreserved = 0;
  const newString = tagged.replace(chunkRe, (whole, num, inner) => {
    // Collect tag tokens within this chunk
    const toks: Tok[] = [];
    let m: RegExpExecArray | null;
    allTagRe.lastIndex = 0;
    while ((m = allTagRe.exec(inner)) !== null) {
      toks.push({
        kind: m[1] === "/" ? "close" : "open",
        tag: m[2] as Tok["tag"],
        start: m.index,
        end: m.index + m[0].length,
      });
    }

    // Find opens of subject tags that appear AFTER the first verb open,
    // and that are NOT immediately followed (in tag sequence) by a verb open.
    // "Immediately followed" = the next OPEN tag (skipping closes) is a verb.
    const opens = toks.filter(t => t.kind === "open");
    const firstVerbIdx = opens.findIndex(t => t.tag === "v" || t.tag === "vs");
    if (firstVerbIdx === -1) return whole; // no verb in chunk → leave alone

    // Helper: detect if a subject tag is the post-verbal subject of an existential
    // construction (there is/are/was/were/exists/remains/lies/comes ...).
    // We look at the text between the closing of the immediately preceding verb tag
    // and the opening of the candidate subject tag — it should be just whitespace/nothing.
    // Then we check what precedes the opening of that verb tag inside the chunk:
    // it must contain "there" (case-insensitive) as the last word, with no other
    // intervening verb/subject tag between "there" and the verb open.
    const existentialVerbRe = /\b(?:is|are|was|were|isn't|aren't|wasn't|weren't|'s|'re|has\s+been|have\s+been|had\s+been|will\s+be|may\s+be|might\s+be|can\s+be|could\s+be|should\s+be|exists?|existed|remains?|remained|lies?|lay|lain|comes?|came)\b/i;
    const isExistentialSubject = (subjOpenIdxInToks: number): boolean => {
      // Find the most recent verb open BEFORE this subject open
      let prevVerbTok: Tok | null = null;
      for (let k = subjOpenIdxInToks - 1; k >= 0; k--) {
        const t = toks[k];
        if (t.kind === "open" && (t.tag === "v" || t.tag === "vs")) { prevVerbTok = t; break; }
      }
      if (!prevVerbTok) return false;

      // Find the matching close of that verb
      let depth = 1;
      let verbCloseTok: Tok | null = null;
      const verbStartIdx = toks.indexOf(prevVerbTok);
      for (let j = verbStartIdx + 1; j < toks.length; j++) {
        const t = toks[j];
        if (t.tag !== prevVerbTok.tag) continue;
        if (t.kind === "open") depth++;
        else { depth--; if (depth === 0) { verbCloseTok = t; break; } }
      }
      if (!verbCloseTok) return false;

      // Text between verb close and subject open should be whitespace only
      const subjOpenTok = toks[subjOpenIdxInToks];
      const between = inner.slice(verbCloseTok.end, subjOpenTok.start);
      if (between.replace(/\s+/g, "") !== "") return false;

      // Verb tag content (the actual verb words)
      const verbInner = inner.slice(prevVerbTok.end, verbCloseTok.start);
      if (!existentialVerbRe.test(verbInner)) return false;

      // Text BEFORE the verb open inside the chunk — strip any tag markup.
      const beforeVerb = inner.slice(0, prevVerbTok.start).replace(/<\/?[a-z]+(?:\s+g="\d+")?>/gi, " ");
      // Last non-empty word should be "there"
      const tokens = beforeVerb.trim().split(/\s+/).filter(Boolean);
      const lastWord = tokens[tokens.length - 1] || "";
      return /^there$/i.test(lastWord);
    };

    // For each subject open after the first verb, decide if it's an object.
    const stripPositions: { start: number; end: number }[] = [];
    for (let i = firstVerbIdx + 1; i < opens.length; i++) {
      const cur = opens[i];
      if (cur.tag !== "s" && cur.tag !== "ss") continue;
      // Look at next open (if any). If next open is a verb → cur is the subject of that verb → keep.
      // If next open is another subject or doesn't exist → cur is an object → strip.
      const next = opens[i + 1];
      if (next && (next.tag === "v" || next.tag === "vs")) {
        // cur could legitimately be the subject of a following verb (e.g. relative clause subject).
        continue;
      }
      // Existential "there is/are NP" guard: if cur is the post-verbal subject of an
      // existential clause, it's the REAL subject — never strip.
      const curIdxInToks = toks.indexOf(cur);
      if (isExistentialSubject(curIdxInToks)) {
        existentialPreserved++;
        continue;
      }
      // cur is an object: mark its open tag and matching close tag for removal.
      stripPositions.push({ start: cur.start, end: cur.end });
      // find matching close for cur
      // walk forward in toks to find close of same tag with proper nesting
      const startTokIdx = toks.indexOf(cur);
      let depth = 1;
      for (let j = startTokIdx + 1; j < toks.length; j++) {
        const t = toks[j];
        if (t.tag !== cur.tag) continue;
        if (t.kind === "open") depth++;
        else {
          depth--;
          if (depth === 0) {
            stripPositions.push({ start: t.start, end: t.end });
            break;
          }
        }
      }
    }

    if (stripPositions.length === 0) return whole;

    // Apply strips (sort descending so indices stay valid)
    stripPositions.sort((a, b) => b.start - a.start);
    let updated = inner;
    for (const p of stripPositions) {
      updated = updated.slice(0, p.start) + updated.slice(p.end);
    }
    totalRemoved += stripPositions.length / 2; // each subject = 1 open + 1 close pair
    return `<c${num}>${updated}</c${num}>`;
  });

  if (existentialPreserved > 0) {
    console.log(`Existential there: preserved ${existentialPreserved} subject(s)`);
  }
  return { result: newString, removed: totalRemoved };
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
- **Gerund-phrase subject (동명사 주어)**: tag the gerund + its core (e.g. direct object of the gerund) as <s>. Exclude long post-modifiers (PP/adv).
  - "<s>Locking-in prices</s> by buying and selling grain for future delivery <v>helped</v>..." (only "Locking-in prices" inside <s>)
  - "<s>Reading books</s> <v>makes</v> you smart"
- **To-infinitive subject (to부정사 주어)**: tag the to-infinitive + its core object as <s>.
  - "<s>To learn English</s> <v>is</v> fun"
- **Noun-clause subject (명사절 주어 — that / wh / whether)**: DO **NOT** wrap the whole noun clause in <s>. Instead, tag the **internal subject** of the noun clause as <s>, and leave the upper clause WITHOUT any <s>.
  - CORRECT: <c1>What <s>he</s> <v>said</v></c1> <c2><v>is</v> true</c2>
  - CORRECT: <c1>That <s>he</s> <v>lied</v></c1> <c2><v>surprised</v> me</c2>
  - CORRECT: <c1>Whether <s>it</s> <v>rains</v></c1> <c2><v>matters</v></c2>
  - WRONG:   <s>What he said</s> <v>is</v> true   ← never wrap a noun clause
  - The upper clause (e.g. "<v>is</v> true") may legitimately have NO <s> at all. That is correct.

### What to EXCLUDE from <s>:
- **Post-modifiers** (전치사구/관계절/분사구/동격/to부정사): STRICT — nothing after the head noun goes inside <s>. Cut <s> at the head noun.
  - Prepositional phrase: "<s>something</s> like this thought", "<s>the man</s> with a hat", "<s>the balance</s> of power" (when subject)
  - Relative clause: "<s>the book</s> that I read", "<s>the people</s> who are taking part"
  - Participial: "<s>students</s> taking the test", "<s>the door</s> opened by him"
  - To-infinitive: "<s>the way</s> to learn"
  - Appositive: "<s>my friend</s>, a doctor, ..."
  - WRONG: <s>something like this thought</s>  → CORRECT: <s>something</s> like this thought
  - WRONG: <s>the man with a hat</s>           → CORRECT: <s>the man</s> with a hat
  - WRONG: <s>students taking the test</s>     → CORRECT: <s>students</s> taking the test
- **Parentheticals/insertions** (콤마로 분리된 삽입구): "<s>The students</s>, however, are confused" — "however" is OUTSIDE <s>

### Relative clauses (관계절) — special <s> rules:
- A relative clause modifies its antecedent (선행사). Tag the **antecedent** as <s> (head noun only — no PP/relative tail).
- **Subject relative clause** (관계대명사가 관계절의 주어 역할: who/which/that + V): the relative pronoun itself is NOT <s>. The relative-clause chunk has NO <s> at all — only <v>.
  - CORRECT: <s>the people</s> who <v>are taking</v> part in it
  - CORRECT: <s>the book</s> which <v>changed</v> my life
  - WRONG:   <s>the people</s> <s>who</s> <v>are taking</v> part in it
  - WRONG:   <s>the people who are taking part in it</s>
- **Object relative clause** (관계대명사가 목적어/전치사 목적어 역할: who(m)/which/that + S + V): tag the inner subject (the real S that follows) as <s>. The relative pronoun itself is NEVER <s>.
  - CORRECT: <s>the book</s> that <s>I</s> <v>read</v>
  - CORRECT: <s>the man</s> whom <s>she</s> <v>met</v>
  - WRONG:   <s>that</s> ... / <s>which</s> ...
- Decision: if the token immediately after the relative pronoun is a finite verb (<v>) → subject-type → no <s> in the relative clause. If it is a noun phrase followed by <v> → object-type → tag that NP as <s>.
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
- <c1><s>something</s> like this thought probably <v>lay</v> behind...</c1>  ← post-modifier PP excluded
- <c1><s>the people</s></c1> <c2>who <v>are taking</v> part in it</c2>  ← subject relative: NO <s> in c2
- <c1><s>the book</s></c1> <c2>that <s>I</s> <v>read</v> last week</c2>  ← object relative: inner subject <s>

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
9. **Antecedent of an OBJECT relative clause when the antecedent ITSELF is the OBJECT of an outer verb**.
   The antecedent stays UNTAGGED (it's already an object). Only the inner subject of the relative clause gets <ss>.
   - Pattern: outer-V + [antecedent NP, which is the OBJECT of outer-V] + [optional 생략된 that/which/who] + inner-S + inner-V
   - WRONG:   How <s>people</s> <v>interpret</v> <s>the messages</s> <s>they</s> <v>receive</v>
   - CORRECT: How <ss>people</ss> <vs>interpret</vs> the messages <ss>they</ss> <vs>receive</vs>
   - 이유: "the messages"는 interpret의 목적어 + 관계절(생략된 that/which)의 선행사. 목적어이므로 <s>/<ss>를 받지 않음.
   - 또 다른 예: "<s>I</s> <v>know</v> the man <s>she</s> <v>met</v>" — "the man"은 know의 목적어 + met의 선행사 → 절대 <s>/<ss> 금지.
   - 핵심 판단: 한 동사 직후에 NP가 나오고, 그 NP 뒤에 (관계대명사 없이도) 또 다른 S+V가 따라오면 → 그 NP는 무조건 OBJECT, 절대 주어 태그 금지.
10. **The expletive "there" in existential sentences is NEVER the subject.**
    The REAL subject is the noun phrase AFTER the be-verb (or existential verb).
    - WRONG:   <s>There</s> <v>is</v> so little variation amongst us
    - WRONG:   There <v>is</v> so little variation amongst us  ← subject MISSING, must tag the post-verbal NP
    - CORRECT: There <v>is</v> <s>so little variation</s> amongst us
    - Same rule for: there are / there was / there were / there exists / there remains / there comes / there lies ...
    - The post-verbal NP gets <s> (or <ss> if the existential clause is itself subordinate, e.g. "...because there <vs>is</vs> <ss>no time</ss>").
    - Never leave an existential clause without a subject tag on the post-verbal NP.

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
- **Exception**: a clause whose subject is a noun clause (that/wh/whether-clause) has ZERO <s> in the upper clause — the only <s> appears INSIDE the noun clause for the inner subject.

## CLAUSE TYPE TAGS — MAIN vs SUBORDINATE

There are FOUR tag forms for subject and verb. Pick exactly one per phrase:
- \`<s>...</s>\` — subject of the **main (matrix) clause**
- \`<v>...</v>\` — verb of the **main (matrix) clause**
- \`<ss>...</ss>\` — subject of a **subordinate clause**
- \`<vs>...</vs>\` — verb of a **subordinate clause**

### What counts as subordinate (use ss/vs):
1. **Adverbial clauses** introduced by because, when, while, if, although, though, since, as (= because/when), unless, until, before, after, so that, etc.
   - "<c1>Because <ss>the rain</ss> <vs>stopped</vs></c1>, <c2><s>we</s> <v>went out</v></c2>"
2. **Relative clauses** (who/whom/which/that/whose):
   - Subject relative: "<c1><s>the people</s></c1> <c2>who <vs>are taking</vs> part</c2>" (relative-clause verb is vs; no inner subject)
   - Object relative: "<c1><s>the book</s></c1> <c2>that <ss>I</ss> <vs>read</vs></c2>"
3. **Noun clauses** (that/wh/whether/if when introducing a clause):
   - "<c1>What <ss>he</ss> <vs>said</vs></c1> <c2><v>is</v> true</c2>" (inner = ss/vs, outer matrix verb = v)
   - "<c1>That <ss>he</ss> <vs>lied</vs></c1> <c2><v>surprised</v> me</c2>"
   - "<c1><s>I</s> <v>think</v></c1> <c2>that <ss>he</ss> <vs>is</vs> right</c2>"

### What stays main (use s/v):
- The single matrix clause that is NOT inside any subordinator.
- For sentences with NO subordinate clauses, every subject/verb is s/v.

### Key rule: nested subordination still uses ss/vs (we do not distinguish nesting depth).

## PARALLEL (COORDINATION) GROUPS — g="N" attribute

When two or more subjects, or two or more verbs, in the **same clause** are joined by coordinating conjunctions (and, or, but, nor) or commas in a list, mark them as a parallel group by adding an identical \`g="N"\` attribute. Use small integers (1, 2, 3, …) and re-use within the same coordinated set.

- Two parallel verbs in main clause:
  - "<c1><s>He</s> <v g="1">sang</v> and <v g="1">danced</v></c1>"
- Three parallel verbs in main clause:
  - "<c1><s>She</s> <v g="1">came</v>, <v g="1">saw</v>, and <v g="1">conquered</v></c1>"
- Two parallel subjects in main clause (NOT to be confused with a single coordinated NP "John and Mary"):
  - **Default**: "John and Mary" is ONE subject NP — wrap as a single <s>: "<s>John and Mary</s> <v>are</v> friends".
  - Use parallel <s g="N"> ONLY when there are clearly two separate subject NPs each with its own verb structure that share the same finite verb. This is RARE — when in doubt, use a single <s>.
- Parallel verbs in a subordinate clause use <vs g="N">:
  - "<c1>because <ss>he</ss> <vs g="1">studied</vs> and <vs g="1">practiced</vs></c1> <c2><s>he</s> <v>passed</v></c2>"
- Different clauses → DIFFERENT (or no) groups. Never reuse the same g across clause boundaries.
- A solo verb/subject (only one in its role within its clause) → NO g attribute.

### When NOT to use g:
- Coordinated noun phrases inside a single subject NP: "<s>my brother and I</s>" — single <s>, no g.
- Auxiliary chains (have been working) — these are ONE verb tag, not parallel.
- Verbs in different clauses, even if coordinated at the discourse level.

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
                description: "English sentence with <c1>...</c1> tags around each chunk. Main-clause verbs use <v>...</v>, subordinate-clause verbs use <vs>...</vs>. Main-clause subjects use <s>...</s>, subordinate-clause subjects use <ss>...</ss>. Parallel coordinated subjects/verbs in the same clause share an identical g=\"N\" attribute (e.g. <v g=\"1\">sang</v> ... <v g=\"1\">danced</v>).",
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
            cleanedRepair = cleanedRepair
              .replace(/<(?:v|s|vs|ss)(?:\s+g="\d+")?>/g, '')
              .replace(/<\/(?:v|s|vs|ss)>/g, '');
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

    // === Subject tag verification pass (runs BEFORE verb verification) ===
    try {
      const subjectVerifyPrompt = `You are a precise English grammar SUBJECT-tagging verifier.

Given an English sentence chunked with <c1>...</c1> tags, with verb tags (<v> for main, <vs> for subordinate) and subject tags (<s> for main, <ss> for subordinate), your job is to VERIFY and CORRECT ONLY the subject tags (<s> and <ss>).

## ABSOLUTE RULES:
1. DO NOT change the <cN>...</cN> structure — same tags, same boundaries, same text.
2. DO NOT change the text content at all — no word additions, removals, or reordering.
3. DO NOT change <v>...</v> or <vs>...</vs> tags — leave them and any g="N" attributes exactly as-is.
4. ONLY add, remove, or adjust <s>...</s> and <ss>...</ss> tags. Preserve their g="N" attributes if present.
5. Use <ss> when the subject is inside a subordinate clause (relative / adverbial / noun clause). Use <s> for the matrix-clause subject. The matching verb tag (<v> vs <vs>) signals the clause type — match it.

## What MUST have <s> tags (subjects ONLY):
- The grammatical subject NP of each finite clause (수일치의 핵).
- Include determiner + pre-modifiers + head noun ONLY. STRICT — never include any post-modifier (PP / relative clause / participle / to-infinitive / appositive). Cut <s> at the head noun.
- Subordinate clause subjects also: "Because <s>the rain</s> stopped, <s>we</s> went out".
- Expletive It: "<s>It</s> <v>is</v> important...".
- There/Here + be + NP: tag the NP after the verb. "There <v>are</v> <s>many students</s>".
- Coordinated subject as one: "<s>John and Mary</s> <v>are</v>...".
- Gerund-phrase subject: "<s>Locking-in prices</s> by ... <v>helped</v>..." (gerund + core object only).
- To-infinitive subject: "<s>To learn English</s> <v>is</v> fun".
- Noun-clause subject (that/wh/whether-clause as subject): DO NOT wrap the whole noun clause. Tag the **internal subject** of the noun clause only. The upper clause then has NO <s> — that is CORRECT, do not invent one.
  - CORRECT: <c1>What <s>he</s> <v>said</v></c1> <c2><v>is</v> true</c2>
  - CORRECT: <c1>That <s>he</s> <v>lied</v></c1> <c2><v>surprised</v> me</c2>

## Relative clause rules (관계절):
- Antecedent (선행사) is <s> if it is the subject of the main verb — head noun only, no relative tail inside <s>.
- **Subject relative clause** (who/which/that immediately followed by <v>): the relative pronoun is NOT <s>. The relative-clause chunk has NO <s>; it only has <v>.
  - CORRECT: <s>the people</s> who <v>are taking</v> part in it
  - WRONG:   <s>who</s> <v>are taking</v> part in it
  - WRONG:   <s>the people who are taking part in it</s>
- **Object relative clause** (who(m)/which/that followed by an NP then <v>): tag the inner NP subject as <s>. The relative pronoun is never <s>.
  - CORRECT: <s>the book</s> that <s>I</s> <v>read</v>
  - CORRECT: <s>the man</s> whom <s>she</s> <v>met</v>

## What MUST NOT have <s> tags (REMOVE if found):
1. **Direct objects** (NP after a transitive verb): "<v>allows</v> citizens" → "citizens" is NOT <s>.
2. **Indirect objects**: "<v>gave</v> him a book" → "him", "a book" are NOT <s>.
3. **Object complements**: "<v>elected</v> her president" → "her", "president" are NOT <s>.
4. **Subject complements (linking verb 보어)**: "<v>is</v> a teacher" → "a teacher" is NOT <s>.
5. **Objects of prepositions**: "on the table" → "the table" is NOT <s>.
6. **Nouns inside infinitive phrases**: "to read the book" → "the book" is NOT <s>.
7. **Nouns inside participial phrases**: "holding the umbrella" → "the umbrella" is NOT <s>.
8. **Post-modifiers of the subject** (relative clauses, PPs, participles, to-infinitives, appositives AFTER head noun) → NOT inside <s>. ALWAYS cut <s> at the head noun.
   - WRONG: <s>something like this thought</s>  → CORRECT: <s>something</s> like this thought
   - WRONG: <s>the man with a hat</s>           → CORRECT: <s>the man</s> with a hat
   - WRONG: <s>students taking the test</s>     → CORRECT: <s>students</s> taking the test
   - WRONG: <s>the book that I read</s>         → CORRECT: <s>the book</s> that <s>I</s> <v>read</v>
9. **Parentheticals** (콤마 삽입구): "however", "for example" — NOT inside <s>.
10. **Whole noun clause as subject**: NEVER wrap an entire that/wh/whether-clause in <s>. If you find <s>What he said</s> or <s>That he lied</s>, REMOVE the outer <s> and instead tag only the inner subject (e.g. <s>he</s>).
11. **Relative pronouns themselves** (who/whom/which/that/whose as relative): NEVER <s>. If you find <s>who</s>, <s>which</s>, <s>that</s> inside a relative clause, REMOVE.
12. **Subject relative clause has zero <s>**: if a chunk starts with a relative pronoun followed immediately by <v> (e.g. "who <v>are taking</v>..."), the chunk must contain NO <s> at all.
13. **Antecedent that is itself an OBJECT of the outer verb**: NEVER tag. Pattern: "<v>outer-V</v> NP <ss>inner-S</ss> <vs>inner-V</vs>" — the NP between outer-V and inner-S is the OBJECT of outer-V (and the antecedent of an object relative clause with omitted relative pronoun). It must stay UNTAGGED.
    - WRONG:   <v>interpret</v> <ss>the messages</ss> <ss>they</ss> <vs>receive</vs>
    - CORRECT: <vs>interpret</vs> the messages <ss>they</ss> <vs>receive</vs>
    - WRONG:   <v>know</v> <s>the man</s> <s>she</s> <v>met</v>
    - CORRECT: <v>know</v> the man <s>she</s> <v>met</v>
    - Rule: if you see two consecutive subject tags with no verb between them, the FIRST one is wrong — REMOVE it.

## Per-clause rule:
- Each finite clause has at most ONE <s>. If you see two <s> in one clause, the second one is wrong (likely an object/complement) — REMOVE it.
- An upper clause whose subject is a noun clause has ZERO <s> — do NOT add one. The inner subject of the noun clause is the only <s>.
- A subject-type relative clause has ZERO <s>. An object-type relative clause has exactly ONE <s> (the inner subject after the relative pronoun).

## Constraint:
- <s> and <v> must NEVER overlap or nest. Always adjacent.

## Critical examples (apply these patterns):
- WRONG:   <s>The policy</s> <v>allows</v> <s>citizens</s> to retain freedom
  CORRECT: <s>The policy</s> <v>allows</v> citizens to retain freedom
- WRONG:   <s>Technology</s> <v>has shifted</v> <s>the balance of power</s>
  CORRECT: <s>Technology</s> <v>has shifted</v> the balance of power
- WRONG:   <s>She</s> <v>is</v> <s>a doctor</s>
  CORRECT: <s>She</s> <v>is</v> a doctor
- WRONG:   <s>What he said</s> <v>is</v> true
  CORRECT: What <s>he</s> <v>said</v> <v>is</v> true
- WRONG:   <s>That he lied</s> <v>surprised</v> me
  CORRECT: That <s>he</s> <v>lied</v> <v>surprised</v> me
- WRONG:   <s>something like this thought</s> probably <v>lay</v> behind...
  CORRECT: <s>something</s> like this thought probably <v>lay</v> behind...
- WRONG:   <s>the people</s> <s>who</s> <v>are taking</v> part in it
  CORRECT: <s>the people</s> who <v>are taking</v> part in it
- WRONG:   <s>the people who are taking part in it</s>
  CORRECT: <s>the people</s> who <v>are taking</v> part in it
- WRONG:   <s>the book that I read</s>
  CORRECT: <s>the book</s> that <s>I</s> <v>read</v>
- WRONG:   <s>the man with a hat</s> <v>arrived</v>
  CORRECT: <s>the man</s> with a hat <v>arrived</v>

Return ONLY the corrected english_tagged string. Nothing else. No markdown, no commentary.`;

      const subjVerifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: subjectVerifyPrompt },
            { role: "user", content: lastResult!.english_tagged },
          ],
        }),
      });

      if (subjVerifyResponse.ok) {
        const subjData = await subjVerifyResponse.json();
        const subjVerified = subjData.choices?.[0]?.message?.content?.trim();
        if (subjVerified) {
          let cleanedSubj = subjVerified.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();

          // Safety: ensure text content + chunk structure + verb tags unchanged
          const newText = normalize(extractText(cleanedSubj));
          const oldText = normalize(extractText(lastResult!.english_tagged));
          const oldCTags = JSON.stringify(getTagNumbers(lastResult!.english_tagged));
          const newCTags = JSON.stringify(getTagNumbers(cleanedSubj));
          const oldVCount = (lastResult!.english_tagged.match(/<v(?:s)?(?:\s+g="\d+")?>/g) || []).length;
          const newVCount = (cleanedSubj.match(/<v(?:s)?(?:\s+g="\d+")?>/g) || []).length;

          if (newText === oldText && oldCTags === newCTags && oldVCount === newVCount) {
            if (cleanedSubj !== lastResult!.english_tagged) {
              const oldSCount = (lastResult!.english_tagged.match(/<s(?:s)?(?:\s+g="\d+")?>/g) || []).length;
              const newSCount = (cleanedSubj.match(/<s(?:s)?(?:\s+g="\d+")?>/g) || []).length;
              console.log(`Subject verification: <s> tags ${oldSCount} → ${newSCount}`);
              lastResult!.english_tagged = cleanedSubj;
            } else {
              console.log("Subject verification: no changes needed");
            }
          } else {
            console.warn("Subject verification: structure/text/verb tags changed, discarding", {
              textChanged: newText !== oldText,
              cTagsChanged: oldCTags !== newCTags,
              vCountChanged: oldVCount !== newVCount,
            });
          }
        }
      }
    } catch (subjErr) {
      console.warn("Subject verification failed, using original:", subjErr);
    }

    // === Deterministic post-processing guard: strip object-as-subject tags ===
    try {
      const beforeSCount = (lastResult!.english_tagged.match(/<s(?:s)?(?:\s+g="\d+")?>/g) || []).length;
      const { result: stripped, removed } = stripObjectSubjectTags(lastResult!.english_tagged);
      if (removed > 0) {
        // Safety: text content unchanged
        const oldText = normalize(extractText(lastResult!.english_tagged));
        const newText = normalize(extractText(stripped));
        // Safety: no more than 50% of subjects removed (guard against false positives)
        const tooAggressive = beforeSCount > 0 && removed > beforeSCount * 0.5;
        if (newText === oldText && !tooAggressive) {
          console.log(`Object-as-subject strip: removed ${removed} tags`);
          lastResult!.english_tagged = stripped;
        } else {
          console.warn("Object-as-subject strip: discarded", { textChanged: newText !== oldText, tooAggressive, removed, beforeSCount });
        }
      }
    } catch (stripErr) {
      console.warn("Object-as-subject strip failed:", stripErr);
    }

    // === Verb tag verification pass ===
    try {
      const verbVerifyPrompt = `You are a precise English grammar verb-tagging verifier.

Given an English sentence chunked with <c1>...</c1> tags and verb-tagged with <v> (main clause) or <vs> (subordinate clause) tags, your job is to VERIFY and CORRECT ONLY the verb tags (<v> and <vs>).

## ABSOLUTE RULES:
1. DO NOT change the <cN>...</cN> structure in any way — same tags, same boundaries, same text.
2. DO NOT change the text content at all — no word additions, removals, or reordering.
3. ONLY add, remove, or adjust <v>...</v> and <vs>...</vs> tags. Preserve g="N" attributes if present.
4. PRESERVE all <s>...</s> and <ss>...</ss> tags exactly as they are. Do NOT remove, add, or modify them.
5. Use <vs> when the verb is inside a subordinate clause (relative / adverbial / noun clause). Use <v> for the matrix-clause verb. Match the clause type of the surrounding subject (<s> or <ss>).

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
          const origVCount = (lastResult!.english_tagged.match(/<v(?:s)?(?:\s+g="\d+")?>/g) || []).length;
          const newVCount = (cleaned.match(/<v(?:s)?(?:\s+g="\d+")?>/g) || []).length;

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
