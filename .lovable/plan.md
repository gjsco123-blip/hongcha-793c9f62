

## analyze-preview 프롬프트 전체 교체

`supabase/functions/analyze-preview/index.ts`의 `systemPrompt` (line 42~145)를 사용자가 제공한 새 프롬프트로 완전 교체합니다.

### 변경 내용

**line 42~145** — systemPrompt 전체를 아래 내용으로 교체:

- **Step 1**: 난이도 판정 기준에 예시 단어 추가 (`necessity, implication, distinction` 등), `interaction` 추가
- **Step 2**: 내부 분석 6개 항목으로 확장 (배경/맥락 정보 식별 항목 추가, 평가 방향 세분화: positive/negative/critical/supportive)
- **Step 3**: Grade별 4개 하위 지침으로 상세화
- **Step 4 출력 규칙**:
  - `one_sentence_summary`: **"Exactly ONE sentence"** + 논리 관계(cause-effect, contrast 등) 반영 필수 + 복수 문장 금지 명시
  - `title`: `abstract noun + of + key concept` 예시 명시 (`impact of ~, role of ~, necessity of ~, distinction between ~`)
- **Korean Exam Rules**: 기존과 동일하나 문구 더 명확하게
- **절대 규칙, JSON 출력 형식, summary 3줄 한국어**: 그대로 유지

### 유지 사항
- JSON 스키마 동일 (`exam_block.topic/title/one_sentence_summary` + `_ko` + `summary`)
- 모델 `google/gemini-3-flash-preview` 유지
- `safeParseJson`, CORS, 에러 처리 등 나머지 코드 변경 없음

### 변경 파일
- `supabase/functions/analyze-preview/index.ts` — systemPrompt 문자열 1곳 교체

