

## analyze-preview 프롬프트 교체

`supabase/functions/analyze-preview/index.ts`의 `systemPrompt`(line 31~134)를 사용자가 제공한 새 프롬프트로 교체합니다.

### 주요 변경점

| 항목 | 기존 | 변경 |
|------|------|------|
| Step 1 난이도 판정 | 간략한 5개 기준 | 더 구체적인 기준 + 예시 포함 |
| Step 2 내부 분석 | 5개 항목 | 6개 항목 (배경/맥락 분리, 평가방향 세분화 추가) |
| Step 3 추상화 조절 | 압축된 설명 | Grade별 상세 지침 |
| Summary 규칙 | 2~3 sentences | **정확히 1 sentence**, 논리 관계 반영 필수 |
| Title 규칙 | 기존과 유사 | `abstract noun + of + key concept` 예시 추가 |

### 유지 사항
- JSON 출력 구조 (`exam_block.topic/title/one_sentence_summary` + 각 `_ko` + `summary` 3줄 한국어) 동일
- 절대 규칙, 출력 형식 동일
- 모델(`google/gemini-2.5-flash`) 동일

### 변경 파일
- `supabase/functions/analyze-preview/index.ts` — systemPrompt 문자열 1곳 교체

