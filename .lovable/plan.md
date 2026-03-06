

## "Key Summary" → "Passage Logic" 변경 + 요약 프롬프트 교체

### 변경 사항

**1. Edge Function 프롬프트 변경** (`supabase/functions/analyze-preview/index.ts`)
- summary 섹션(141~168행)의 기존 3문장 이야기형 요약 프롬프트를 사용자가 제공한 4문장 구조화 프롬프트로 교체
- 출력 형식: `"①...\\n②...\\n③...\\n④..."` (4줄, `\n` 구분)
- 절대 규칙의 "3줄" → "4줄"로 변경

**2. 웹 UI 이름 변경** (`src/components/preview/PreviewSummarySection.tsx`)
- `SectionHeader title="Key Summary"` → `"Passage Logic"`
- `CompareOverlay title="Key Summary"` → `"Passage Logic"`

**3. PDF 이름 변경** (`src/components/PreviewPdf.tsx`)
- `secTitle` 텍스트 `"Key Summary"` → `"Passage Logic"`

**4. Structure 프롬프트 참조 수정** (`supabase/functions/analyze-structure/index.ts`)
- "Key Summary" 언급을 "Passage Logic"으로 변경

### 작업 목록
1. Edge function 프롬프트 교체 (summary 생성 로직)
2. 웹 UI + PDF에서 "Key Summary" → "Passage Logic" 이름 변경

