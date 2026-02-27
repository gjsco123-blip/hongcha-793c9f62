

## 문제 원인

MEMO 칼럼이 왼쪽 본문 높이에 맞춰 늘어나지 않는 이유:

`contentRow`에 `flexGrow: 0, flexShrink: 0`이 설정되어 있어서, 이 행이 **페이지 전체 높이까지 확장되지 않음**. `alignItems: "stretch"`는 자식 간 높이를 맞추지만, 부모 자체가 콘텐츠 높이만큼만 차지하므로 MEMO도 본문 콘텐츠 높이까지만 늘어남 — 그 아래 빈 공간(TEXT ANALYSIS 전까지)은 비게 됨.

즉, MEMO 배경이 페이지 하단(또는 TEXT ANALYSIS 섹션 직전)까지 채워지지 않고, 마지막 문장 블록 높이에서 끊김.

## 해결 방법

`contentRow`에 `flexGrow: 1`을 적용하여 남는 공간을 채우도록 변경. 이렇게 하면 MEMO 칼럼이 페이지 하단(또는 TEXT ANALYSIS 직전)까지 자동 확장됨.

## 수정 파일

**`src/components/PdfDocument.tsx`** — `styles.contentRow` 변경:

```
contentRow: {
  flexDirection: "row",
  alignItems: "stretch",
  flexGrow: 1,    // ← 0에서 1로 변경: 남은 페이지 공간을 채움
  flexShrink: 0,
}
```

1줄 변경으로 해결.

