

## 변경 사항

### 1. PDF에서 "Synonyms & Antonyms" 섹션 제목 제거
**`src/components/PreviewPdf.tsx`** (255번 줄)
- `<Text style={s.secTitle}>Synonyms & Antonyms</Text>` 삭제
- `thinRule` 구분선은 유지 → 약 14pt 절약으로 1페이지 유지

### 2. 웹 UI에서도 "Synonyms & Antonyms" 섹션 제목 제거
**`src/components/preview/PreviewSynonymsSection.tsx`** (59번 줄)
- `<SectionHeader title="Synonyms & Antonyms" .../>` 제거
- 테이블 헤더(Word/Synonym/Antonym)가 이미 충분히 역할을 하므로 중복 제거
- Regenerate 기능은 섹션 헤더에 붙어있으므로, 테이블 위에 작은 재생성 버튼을 별도로 배치

### 3. Vocabulary 항목별 재생성(품사 수정) 버튼 추가
**`src/components/preview/PreviewVocabSection.tsx`**
- 각 어휘 행의 삭제 버튼 옆에 `RefreshCw` 아이콘 버튼 추가
- hover 시에만 표시 (기존 삭제 버튼과 동일한 패턴)
- 클릭 시 해당 단어를 `analyze-single-vocab`로 재분석하여 품사/뜻 갱신

**`src/components/preview/PreviewVocabSection.tsx`** Props 변경:
- `onRegenItem: (index: number) => void` 추가

**`src/pages/Preview.tsx`**
- `handleVocabRegenItem` 콜백 추가: 해당 인덱스의 단어를 `analyze-single-vocab`로 재호출하여 결과로 교체
- `PreviewVocabSection`에 `onRegenItem` prop 전달

