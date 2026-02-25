

## 헤더 하단 줄 분리 계획

### 현재 구조
- `header` 스타일: `borderBottomWidth: 2, borderBottomColor: "#000"` → 전체 너비 검은 줄
- 본문: `leftColumn`(`flex: 1`, `paddingRight: GAP`) + `memoColumn`(`width: MEMO_WIDTH`)
- `GAP = 8.5`pt, `MEMO_WIDTH = 100`pt

### 변경 내용

**`src/components/PdfDocument.tsx`**

1. `styles.header`에서 `borderBottomWidth`, `borderBottomColor` 제거

2. 헤더 JSX 내부, Title/Subtitle 아래에 `flexDirection: "row"` View 추가:

```text
변경 후 구조:

│  Title / Subtitle                               │
│                                                  │
│  ████████████████████████│         │█████████████│
│  회색 줄 (flex:1)        │ GAP     │ 검은 줄     │
│  paddingRight: GAP       │ (8.5pt) │ width: 100  │
│                          │         │             │
│  본문 (flex:1)           │ GAP     │ MEMO (100)  │
│  paddingRight: GAP       │ (8.5pt) │             │
```

핵심: 줄도 본문과 동일하게 `flex:1` + `paddingRight: GAP` / `width: MEMO_WIDTH` 구조를 사용하여 공백 위치와 너비가 정확히 일치하도록 함.

구체적 JSX:
```jsx
{/* 헤더 하단 분리 줄 */}
<View style={{ flexDirection: "row" }}>
  <View style={{ flex: 1, paddingRight: GAP }}>
    <View style={{ height: 2, backgroundColor: "#ccc" }} />
  </View>
  <View style={{ width: MEMO_WIDTH }}>
    <View style={{ height: 2, backgroundColor: "#000" }} />
  </View>
</View>
```

`leftColumn`이 `flex:1`에 `paddingRight: GAP`을 사용하므로, 줄도 동일한 방식으로 배치하면 padding 영역이 자연스럽게 공백이 되어 본문의 좌우 컬럼 간격과 정확히 일치함.

### 수정 파일
- `src/components/PdfDocument.tsx` — header 스타일 및 JSX 수정

