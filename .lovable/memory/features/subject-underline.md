---
name: Subject Underline (S)
description: Beta feature flag that underlines core subject NPs with same style as verbs. Engine emits <s> tags; rendering gated by `subject_underline` flag.
type: feature
---
- **Flag**: `subject_underline` (initially OFF for all). Toggle in /admin.
- **Tag**: Engine emits `<s>...</s>` inside `<cN>` chunks. Korean output strips `<s>`.
- **Scope (Option A)**: Determiner + pre-modifiers + head noun ONLY. Excludes post-modifiers (PP/relative/participle/appositive) and parentheticals.
- **Subordinate clauses**: subject of finite verbs inside subordinate clauses also tagged.
- **There/Here + be + NP**: tag NP after the verb (NOT `there/here`).
- **Expletive It**: tag `It` as `<s>` (no real NP head; agreement defaults to singular).
- **Coordinated subject** (`A and B`): wrap whole NP in one `<s>`.
- **Constraint**: `<v>` and `<s>` never overlap or nest — always adjacent.
- **Rendering**: same style as verb underline (solid line). PdfDocument/ResultDisplay both gated by `useFeatureFlag("subject_underline")`.
- **Data model**: `ChunkSegment.isSubject?: boolean`. `segmentsToWords`/`wordsToSegments` propagate it. Editor verb-toggle preserves subject status.
- **Backwards compat**: Old data without `<s>` works fine. Flag OFF hides the underline; data still saved with tags for forward compat.