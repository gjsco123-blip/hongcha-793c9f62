

# 직역/의역 수동 편집 + 의역 재생성 기능

## 현재 상태
- 직역: `ResultDisplay`로 청크 표시만 (편집 불가)
- 의역: `ResultDisplay`로 텍스트 표시만 (편집 불가, 재생성 불가)

## 수정 사항

### 1. `src/components/ResultDisplay.tsx` — 인라인 편집 지원
- 의역 (text 모드): 클릭 시 textarea로 전환, blur/Enter 시 저장
- 직역 (chunks 모드): 각 청크 텍스트 클릭 시 input으로 전환, blur 시 저장
- `onTextChange?: (text: string) => void` 와 `onChunkTextChange?: (index: number, text: string) => void` props 추가

### 2. `src/pages/Index.tsx` — 의역 재생성 + 편집 핸들러
- 의역 영역에 재생성 버튼 (RefreshCw) 추가
- 재생성 시 engine 함수 호출 → `korean_natural`만 추출 → CompareOverlay로 비교 후 적용/유지 선택
- `koreanNatural` 수동 편집 핸들러 연결
- `koreanLiteralChunks` 개별 텍스트 수동 편집 핸들러 연결

### 3. UI 구조 (의역 영역)
```text
┌─────────────────────────────────┐
│ 의역  [재생성↻]            [X] │
│ 클릭하면 편집 가능한 텍스트       │
└─────────────────────────────────┘
```

