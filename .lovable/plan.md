

## 동/반의어 프롬프트 교체 + 마크다운 테이블 파싱

### 변경 사항

**1. Edge Function 프롬프트 + 파싱 변경** (`supabase/functions/analyze-synonyms/index.ts`)
- 기존 JSON 출력 프롬프트를 사용자가 제공한 상세 지침(시험 출제자 관점, 8~12개 단어, 한국어 뜻 포함, 동의어 최대 3개/반의어 최대 2개)으로 교체
- 출력이 마크다운 테이블이므로 `safeParseJson` → 마크다운 테이블 파서로 교체
- 파싱 결과는 기존 `SynAntItem` 타입(`{ word, synonym, antonym }`) 유지 — 각 필드에 한국어 뜻 포함 문자열 저장 (예: `"recognize (인식하다)"`, `"identify(확인하다), acknowledge(인정하다)"`)

**2. 타입 변경 없음**
- `SynAntItem { word: string; synonym: string; antonym: string }` 그대로 유지
- 한국어 뜻과 복수 동의어/반의어가 문자열 안에 포함되므로 타입 변경 불필요

**3. 웹 UI / PDF 디자인 유지**
- 기존 테이블 레이아웃 그대로 유지 (디자인 변경 없음)
- 내용이 길어지므로 텍스트 줄바꿈만 자연스럽게 처리

### 작업 목록
1. Edge function 프롬프트 교체 + 마크다운 테이블 파서 구현
2. (디자인/타입 변경 없음)

