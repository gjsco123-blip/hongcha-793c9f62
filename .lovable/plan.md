

# 프리미엄 미니멀 UI 리디자인 — ElevenLabs 레퍼런스 기반

## ElevenLabs 디자인에서 가져올 핵심 요소
- 따뜻한 크림 배경 (#faf9f6 느낌) — 순백이 아닌 off-white
- **Pill 형태 버튼** (rounded-full), 검정 채움 + 흰 테두리 아웃라인
- 큰 타이포그래피 위계 (제목 크고 bold, 본문은 가벼움)
- 넉넉한 여백 (dense하지 않고 여유로운 spacing)
- 카드에 부드러운 border-radius (rounded-xl)
- 장식 최소화 — 이모지 전면 제거

## 변경 파일 및 내용 (기능 변경 없음, 스타일만)

### 1. 글로벌 토큰 (`src/index.css`)
- `--radius`: `0.125rem` → `0.625rem`
- `--background`: `0 0% 100%` → `30 20% 98%` (따뜻한 off-white)
- `--border`: `0 0% 75%` → `0 0% 88%` (은은한 테두리)
- `--muted`: `0 0% 94%` → `30 10% 95%`

### 2. Auth (`src/pages/Auth.tsx`)
- 제목 크기 확대 (`text-2xl`)
- 로그인 버튼 → `rounded-full`
- 전환 버튼 스타일 정제

### 3. CategorySelector (`src/components/CategorySelector.tsx`)
- 학교/지문 항목: 더 넉넉한 패딩
- 추가 버튼: `rounded-full`
- Step 라벨 정제
- "← 학교 목록으로" → 깔끔한 텍스트

### 4. Index (구문분석) (`src/pages/Index.tsx`)
- 헤더: `border-b-2 border-foreground` → `border-b border-border`
- 결과 영역: `border-t-2 border-foreground` → `border-t border-border`
- 모든 버튼: `rounded-full` pill 형태
- textarea: `rounded-xl`
- 결과 카드 (`bg-muted/50 border`): `rounded-xl` 추가
- 페이지 구분선: ✂️ 이모지 제거 → 텍스트만
- 페이지 상태: 📄 ✅ ⚠️ 이모지 제거, `rounded-xl`
- 청크 힌트 텍스트: "✏️ 편집 · 클릭..." → 이모지 제거

### 5. Preview (`src/pages/Preview.tsx`)
- 헤더: Index와 동일하게 `border-b border-border`
- 버튼: `rounded-full` pill
- 전체적으로 Index와 통일

### 6. PreviewPassageInput
- textarea: `rounded-xl`
- Generate 버튼: `rounded-full`
- 모드 버튼: ✓, 📝 이모지 제거, `rounded-full`

### 7. PreviewVocabSection
- 테이블 컨테이너: `rounded-xl overflow-hidden`

### 8. PreviewSynonymsSection
- 테이블: `rounded-xl overflow-hidden`

### 9. CompareOverlay
- 컨테이너: `rounded-xl`
- 버튼: `rounded-full`

### 10. ChunkEditor
- 청크 태그: `rounded-md` (기존 사각형 → 약간 둥글게)
- 힌트 텍스트 "✏️" 제거

### 11. SentencePreview
- 외부 컨테이너: `rounded-xl`

### 12. ResultDisplay
- 청크 태그: `rounded-md`

### 13. SyntaxNotesSection / HongTSection
- 컨테이너: `rounded-xl`
- 버튼: `rounded-full`

### 14. SectionHeader (Preview)
- 재생성 버튼: `rounded-full`

## 변경하지 않는 것
- 모든 기능/로직/API/데이터 흐름
- PDF 출력 (PdfDocument.tsx, PreviewPdf.tsx)
- pdf-pagination.ts
- 색상 팔레트 (검정/흰색/회색 유지, background만 따뜻한 톤)

