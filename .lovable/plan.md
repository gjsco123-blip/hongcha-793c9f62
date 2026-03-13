

# 위첨자 불일치 원인 분석 및 해결

## 근본 원인

위첨자 위치를 결정하는 로직이 **두 곳에 독립적으로 구현**되어 있어 결과가 다릅니다:

```text
웹 UI:  renderWithSuperscripts()  → 원문 전체에서 indexOf로 매칭
PDF:    renderChunksWithVerbUnderline() → 청크/세그먼트 좌표로 변환 후 매칭
```

두 시스템의 차이점:
- **웹**: `text.indexOf(targetText)` → 매칭 시작 위치 **앞**에 위첨자
- **PDF**: `fullText.indexOf(targetText)` → 매칭 시작 위치를 청크 좌표로 변환 → 해당 세그먼트 **앞**에 위첨자

변환 과정에서 공백, 슬래시 구분자, 청크 경계 등이 오프셋을 틀어지게 만들어 위첨자가 다른 위치에 나타남.

## 해결 방안

**공통 매칭 함수**를 만들어 웹과 PDF가 동일한 결과를 사용하도록 통일합니다.

### 공통 함수 (`src/lib/syntax-superscript.tsx`)

```typescript
// 원문에서 각 targetText의 매칭 위치(start)를 반환
function computeSuperscriptPositions(
  originalText: string, 
  syntaxNotes: SyntaxNoteWithTarget[]
): Map<number, number[]>  // start position → [note ids]
```

### PDF 렌더러 수정 (`PdfDocument.tsx`)

`renderChunksWithVerbUnderline`에서 독자적인 매칭 로직을 제거하고, `computeSuperscriptPositions`의 결과(원문 기준 절대 위치)를 청크 좌표로 변환하는 로직만 유지합니다. 핵심은 **매칭은 공통, 렌더링만 분리**.

### 수정 파일
1. **`src/lib/syntax-superscript.tsx`** — `computeSuperscriptPositions` 공통 함수 추가
2. **`src/components/PdfDocument.tsx`** — 공통 함수 사용하도록 `renderChunksWithVerbUnderline` 리팩터링

