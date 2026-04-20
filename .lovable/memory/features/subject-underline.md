---
name: Subject Underline (S)
description: Beta feature flag that underlines core subject NPs with same style as verbs. Engine emits <s> tags; rendering gated by `subject_underline` flag.
type: feature
---
- **Flag**: `subject_underline` (initially OFF for all). Toggle in /admin.
- **Tag**: Engine emits `<s>...</s>` inside `<cN>` chunks. Korean output strips `<s>`.
- **Scope (Option A)**: Determiner + pre-modifiers + head noun ONLY. Excludes post-modifiers (PP/relative/participle/appositive) and parentheticals.
- **Strict head-noun cutoff**: NEVER include any post-modifier inside `<s>` — cut at the head noun. Examples: `<s>something</s> like this thought` (not `<s>something like this thought</s>`), `<s>the man</s> with a hat`, `<s>students</s> taking the test`.
- **Subordinate clauses**: subject of finite verbs inside subordinate clauses also tagged.
- **Relative clauses (B안)**:
  - Antecedent (선행사) gets `<s>` — head noun only, no relative tail inside.
  - **Subject relative** (who/which/that + V): relative pronoun is NEVER `<s>`. The relative-clause chunk has ZERO `<s>` (only `<v>`). Example: `<s>the people</s> who <v>are taking</v> part in it`.
  - **Object relative** (who(m)/which/that + S + V): tag the inner subject as `<s>`. Relative pronoun never `<s>`. Example: `<s>the book</s> that <s>I</s> <v>read</v>`.
- **There/Here + be + NP**: tag NP after the verb (NOT `there/here`).
- **Expletive It**: tag `It` as `<s>` (no real NP head; agreement defaults to singular).
- **Coordinated subject** (`A and B`): wrap whole NP in one `<s>`.
- **Gerund-phrase subject**: tag gerund + core object only (e.g. `<s>Locking-in prices</s>`), exclude long PP/adv post-modifiers.
- **To-infinitive subject**: tag `to + V + core object` (e.g. `<s>To learn English</s>`).
- **Noun-clause subject (that/wh/whether)**: NEVER wrap the whole noun clause. Tag the **internal subject** only (e.g. `What <s>he</s> <v>said</v> <v>is</v> true`). The upper clause may have ZERO `<s>` — that is correct. Avoids `<s>`/`<v>` overlap.
- **Constraint**: `<v>` and `<s>` never overlap or nest — always adjacent.
- **Rendering**: same style as verb underline (solid line). PdfDocument/ResultDisplay both gated by `useFeatureFlag("subject_underline")`.
- **Data model**: `ChunkSegment.isSubject?: boolean`. `segmentsToWords`/`wordsToSegments` propagate it. Editor verb-toggle preserves subject status.
- **Backwards compat**: Old data without `<s>` works fine. Flag OFF hides the underline; data still saved with tags for forward compat.