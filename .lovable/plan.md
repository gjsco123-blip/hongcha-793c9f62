

## 원칙 확인

MEMO 칼럼의 원칙: **각 페이지 마지막 문장 블록 하단에 맞춰 끝남** (페이지 전체를 채우는 것이 아님).

## 문제

이전 수정에서 `contentRow`의 `flexGrow`를 `1`로 변경하여 MEMO가 페이지 전체 높이까지 확장되도록 만들었는데, 이것이 원칙에 반함.

## 수정

**파일**: `src/components/PdfDocument.tsx`

`contentRow.flexGrow`를 `1` → `0`으로 되돌림:

```
contentRow: {
  flexDirection: "row",
  alignItems: "stretch",
  flexGrow: 0,    // 마지막 문장에 맞춰 끝남
  flexShrink: 0,
}
```

`alignItems: "stretch"`가 이미 좌우 컬럼 높이를 동일하게 맞추므로, MEMO는 자연스럽게 마지막 문장 하단에 정렬됨.

