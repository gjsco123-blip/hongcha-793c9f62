

## 수정 사항 (3건)

### 1. 밑줄 앞 공백 분리 (웹 UI)

**ResultDisplay.tsx (31번 줄)**

공백을 밑줄 span 밖으로 분리:

기존: `{wi > 0 ? " " : ""}{w.word}` (밑줄 span 내부)

변경: 공백을 별도 요소로 분리하여 밑줄이 단어 첫 글자에서 정확히 시작

### 2. 밑줄 앞 공백 분리 (PDF)

**PdfDocument.tsx (130~136번 줄)**

동일하게 공백을 별도 `<Text>`로 분리

### 3. 준동사 제외 프롬프트 강화

**engine/index.ts (87번 줄)**

현재 프롬프트:
> "Do NOT tag gerunds used as nouns, infinitives used as nouns/adjectives, or participles used purely as adjectives."

이것만으로는 AI가 to-부정사를 여전히 동사로 태깅함. 더 명확하게 강화:

> "ONLY tag finite verbs (verbs that function as the main predicate of a clause or sentence). Do NOT tag any non-finite verbs: no to-infinitives (e.g., to engage, to achieve), no gerunds (-ing used as nouns), no participles used as adjectives. The 'to' in to-infinitives must NEVER be inside a v tag."

이렇게 하면 `to engage`, `to achieve` 같은 준동사는 밑줄 없이 표시되고, `is`, `gratifies`, `does not add`, `removes` 같은 본동사만 밑줄 처리됨.

### 변경 파일

| 파일 | 변경 |
|------|------|
| src/components/ResultDisplay.tsx | 공백을 밑줄 span 밖으로 분리 |
| src/components/PdfDocument.tsx | 공백을 밑줄 Text 밖으로 분리 |
| supabase/functions/engine/index.ts | 준동사 제외 규칙 강화 |

