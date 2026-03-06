

## Structure → Synonyms & Antonyms 교체

기존 Structure 섹션을 완전히 제거하고 동/반의어(Synonyms & Antonyms) 섹션으로 대체합니다.

### 새 데이터 타입

```text
SynAntItem {
  word: string;          // 지문에 나온 단어
  synonym: string;       // 동의어
  antonym: string;       // 반의어
}
```

### 변경 목록

**1. 새 Edge Function 생성**: `supabase/functions/analyze-synonyms/index.ts`
- 지문에서 핵심 단어 10~15개를 추출하고 각각의 동의어/반의어를 생성
- 기존 vocab 목록의 단어를 우선 활용하되, 추가 단어도 포함
- 모델: `google/gemini-3-flash-preview`

**2. 타입 수정**: `src/components/preview/types.ts`
- `StructureStep` 제거 → `SynAntItem` 추가

**3. 웹 UI 교체**: `PreviewStructureSection.tsx` → `PreviewSynonymsSection.tsx`
- 테이블 형태로 Word / Synonym / Antonym 표시
- 편집 가능, 재생성 + 비교 오버레이 유지

**4. Preview 페이지 수정**: `src/pages/Preview.tsx`
- Structure 관련 state/로직 전부 제거
- Synonyms & Antonyms state/로직으로 교체
- `analyze-structure` 호출 → `analyze-synonyms` 호출로 변경

**5. PDF 수정**: `src/components/PreviewPdf.tsx`
- Structure 섹션 제거
- Synonyms & Antonyms 테이블 섹션 추가 (Word | Synonym | Antonym)

**6. 삭제 대상**
- `supabase/functions/analyze-structure/index.ts` (Edge Function 삭제)
- `PreviewStructureSection.tsx` (새 파일로 교체)

