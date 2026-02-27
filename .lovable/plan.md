

## 문제 원인

`PdfDocument.tsx`의 `estimateSentenceHeight`가 번역 행(직역/의역/홍T/구문)의 **텍스트 줄바꿈을 무시**하고, 각 행을 고정 `12pt`로 계산함.

실제로 홍T 노트가 100~200자인 경우 PDF에서 3~4줄로 렌더링되어 ~35pt를 차지하지만, 추정은 12pt만 잡음. 이 과소 추정 때문에:

1. 페이지네이션이 문장 1~5를 1페이지에 넣을 수 있다고 판단
2. 실제 PDF에서는 높이 초과 → react-pdf가 `wrap={false}`로 문장 5를 2페이지로 밀어냄
3. 문장 6 + TEXT ANALYSIS가 3페이지로 넘어감

**비교**: `Index.tsx`의 웹 페이지 구분선 로직은 이미 `estimateRowH`로 텍스트 길이 기반 줄바꿈 추정을 하고 있음. PDF 쪽만 고정값을 사용 중.

## 수정

**파일**: `src/components/PdfDocument.tsx` — `estimateSentenceHeight` 함수

`Index.tsx`와 동일한 방식으로 번역 행 높이를 텍스트 길이 기반으로 계산:

```typescript
function estimateSentenceHeight(result: SentenceResult, isLast: boolean): number {
  let h = 0;
  const engText =
    result.englishChunks.length > 0 ? result.englishChunks.map((c) => c.text).join(" / ") : result.original;
  const engLines = Math.ceil(engText.length / 70);
  h += engLines * 21;
  h += 6;

  if (result.englishChunks.length > 0) {
    const TRANS_CHARS = 65; // 번역 행 가용 너비 기준 글자수
    const TRANS_LINE_H = 6.5 * 1.8; // fontSize 6.5 × lineHeight 1.8
    const TRANS_ROW_GAP = 3;

    const estimateRowH = (text: string) => {
      const lines = Math.max(1, Math.ceil(text.length / TRANS_CHARS));
      return lines * TRANS_LINE_H + TRANS_ROW_GAP;
    };

    if (!result.hideLiteral) {
      const litText = result.koreanLiteralChunks.map(c => c.text).join(" / ");
      h += estimateRowH(litText);
    }
    if (!result.hideNatural) {
      h += estimateRowH(result.koreanNatural);
    }
    if (result.hongTNotes && !result.hideHongT) {
      h += estimateRowH(result.hongTNotes);
    }
    if (result.syntaxNotes) {
      for (const n of result.syntaxNotes) {
        h += estimateRowH(n.content);
      }
    }
  }

  if (!isLast) {
    h += 14 + 8;
  }

  return h;
}
```

핵심 변경: 고정 `rowH = 12` → 텍스트 길이에 따른 줄바꿈 추정. 이렇게 하면 긴 홍T/직역 텍스트가 있는 문장의 높이가 정확해지고, 1페이지에 4문장만 배치 → 문장 5~6 + TEXT ANALYSIS가 2페이지에 수용됨.

