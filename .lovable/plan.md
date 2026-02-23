

## 문제 원인

`react-pdf`의 `Page` 컴포넌트는 기본적으로 자식 요소를 페이지 전체 높이로 늘립니다 (flex container의 기본 `alignItems`가 `stretch`). 따라서 `contentRow`가 페이지 높이 전체를 차지하고, 그 안의 MEMO 컬럼도 함께 늘어납니다.

## 수정 방안

**`src/components/PdfDocument.tsx`** 한 파일만 수정:

1. **Page 스타일에 `flexGrow` 제어 추가**: Page 내부에서 contentRow가 콘텐츠 높이만큼만 차지하도록 `page` 스타일에 `justifyContent: "flex-start"`를 명시적으로 추가
2. **contentRow에 `alignSelf: "flex-start"` 추가**: 부모(Page)가 stretch하더라도 contentRow 자체가 콘텐츠 높이만 차지하도록 강제
3. **contentRow를 View로 한 번 더 감싸기**: Page의 직접 자식이 아닌 래퍼 안에 넣어서 stretch 영향을 차단

구체적으로는 `contentRow` 스타일에 다음을 추가합니다:

```
contentRow: {
  flexDirection: "row",
  alignItems: "stretch",  // 좌우 컬럼 높이 동일 (유지)
  flexGrow: 0,
  flexShrink: 0,
  alignSelf: "flex-start",  // <-- 핵심: Page가 stretch해도 이 row는 콘텐츠 높이만 유지
},
```

이렇게 하면:
- `alignItems: "stretch"` -- 좌측 본문과 우측 MEMO가 같은 높이 유지
- `alignSelf: "flex-start"` -- contentRow 자체는 콘텐츠(왼쪽 문장들)의 실제 높이만큼만 차지
- 결과: MEMO 하단이 마지막 문장의 직역/의역/홍T/구문독해 중 마지막 요소 끝 부분과 정확히 일치

만약 `alignSelf`만으로 해결되지 않으면, 대안으로 contentRow 전체를 `<View style={{ flexGrow: 0 }}>` 래퍼로 감싸는 방식을 적용합니다.
