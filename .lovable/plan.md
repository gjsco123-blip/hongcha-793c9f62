

# 위첨자 렌더링 버그 수정 (웹 + PDF)

두 곳에서 각각 다른 버그가 발생하고 있음:

## 버그 분석

**웹 UI** (`src/lib/syntax-superscript.tsx` — `renderWithSuperscripts`):
- 원인: 여러 annotation의 targetText가 겹치는 영역을 가리킬 때, 이전 match가 커서를 이동시킨 후에도 다음 match가 이미 소비된 텍스트를 다시 출력
- 결과: "restrict"가 두 번 나타남

**PDF** (`src/components/PdfDocument.tsx` — `renderChunksWithVerbUnderline`):
- 원인: `superscriptMap`의 키가 `${chunkIndex}-${segmentIndex}`인데, 두 개의 annotation이 같은 세그먼트에 매핑되면 Map이 덮어써서 먼저 등록된 위첨자가 사라짐
- 결과: 위첨자 3이 누락됨

## 수정 내용

### 1. `src/lib/syntax-superscript.tsx`
`renderWithSuperscripts`의 match 순회 루프에 겹침 방지 가드 추가:
```typescript
for (const m of matches) {
  if (m.start < cursor) continue;  // 겹치는 매치 건너뛰기
  // ... 기존 로직
}
```

### 2. `src/components/PdfDocument.tsx`
`superscriptMap`을 단일 값이 아닌 **배열**로 변경하여 한 세그먼트에 여러 위첨자를 저장할 수 있게 하고, 렌더링 시 해당 세그먼트의 모든 위첨자를 표시:
- Map 타입: `Map<string, { id: number; offset: number }>` → `Map<string, { id: number; offset: number }[]>`
- 렌더링: offset 기준으로 정렬 후 각 위첨자를 올바른 위치에 삽입

변경 파일 2개, 로직만 수정.

