

## Builder 관련 코드 전체 삭제 계획

### 삭제 대상 파일
- `src/pages/PassageBuilder.tsx` — 빌더 페이지 전체
- `src/components/PassageBuilderPdf.tsx` — 빌더 PDF 컴포넌트

### 삭제 대상 엣지 함수
- `supabase/functions/analyze-explanation/index.ts`
- `supabase/functions/analyze-structure/index.ts`
- `supabase/functions/analyze-vocab/index.ts`
- `supabase/functions/analyze-single-vocab/index.ts`

(이 4개 함수는 빌더 전용 분석 함수들입니다.)

### 수정 대상 파일

**`src/App.tsx`**
- `import PassageBuilder` 제거 (7줄)
- `<Route path="/passage-builder" ...>` 제거 (21줄)

**`src/pages/Index.tsx`**
- Builder 버튼 (535~542줄) 제거
- `BookOpen` import에서 제거

### 변경 없는 파일
- Preview 관련 파일, engine/grammar/hongt/regenerate/spellcheck 엣지 함수 등은 빌더와 무관하므로 유지

