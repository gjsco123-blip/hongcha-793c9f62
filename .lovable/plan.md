

## 진짜 원인 분석 — 이전 수정이 안 먹은 이유

이번 증상은 `ChunkEditor.tsx` 문제가 아니라 **PDF 렌더링 경로 문제**임.

### 왜 그대로였나
이전에 수정한 건 웹 에디터 쪽:
- `src/components/ChunkEditor.tsx`

그런데 지금 올린 화면은 웹 청킹 UI가 아니라 **분석 PDF 미리보기/출력 화면**이고, 이 화면은:
- `src/components/PdfDocument.tsx`

에서 따로 렌더됨.  
즉, `ml-1` 수정은 웹에는 영향이 있어도 **PDF에는 0 영향**이라서 사용자가 보기엔 “그대로”가 맞음.

---

## PDF에서 슬래시 앞 공백이 사라진 실제 이유

`PdfDocument.tsx`에서 슬래시는 현재 이렇게 렌더됨:

```tsx
<Text key={`slash-${ci}`} style={styles.englishWord}>
  {" / "}
</Text>
```

겉보기엔 앞뒤 공백이 다 있어 보이지만, PDF 엔진에서는 이 공백이 CSS처럼 안정적으로 유지되지 않음.

### 핵심 원인 1 — 공백이 아니라 “텍스트 경계” 문제
S/V 기능 추가 후 영어 줄이 더 이상 하나의 연속 문자열이 아니라:

- 일반 구간: `<Text>`
- S/V 라벨 구간: `<View style={styles.labeledWrap}> ... </View>`

처럼 **조각난 노드들**로 렌더됨.

이 상태에서 슬래시가 별도 `<Text>{" / "}</Text>` 로 들어가면,
특히 **앞쪽 leading space**가 텍스트 경계에서 정규화/trim되어
`categories/ taken`처럼 **슬래시가 앞 단어에 붙어 보이는 현상**이 생김.

### 핵심 원인 2 — 이전엔 우연히 덜 보였음
기능 추가 전에는 chunk/segment 구조가 지금보다 단순해서,
슬래시 앞 공백 손실이 지금처럼 눈에 띄지 않았을 가능성이 큼.

즉 이번 문제는:
- “슬래시 margin 부족”이 본질이 아니라
- **react-pdf에서 문자열 공백에 spacing을 의존한 방식 자체가 불안정**해서 생긴 것

---

## 해결 방향 — 공백 문자열 의존 제거

### 가장 안전한 해결책
슬래시를 `" / "` 문자열로 두지 말고:

1. 슬래시 텍스트는 `"/"`만 렌더
2. 앞뒤 간격은 **문자 공백이 아니라 레이아웃 margin**으로 보장

예시 방향:
```tsx
<Text key={`slash-${ci}`} style={styles.chunkSlash}>
  /
</Text>
```

```ts
chunkSlash: {
  ...styles.englishWord,
  marginLeft: 4,
  marginRight: 4,
}
```

### 왜 이게 맞나
- 문자열 공백 trim 이슈를 완전히 회피
- S/V 라벨과 독립적
- PDF 엔진에서도 spacing이 안정적
- “기능추가 전 느낌”을 가장 정확하게 복원 가능

---

## S/V 기능과 충돌 없는 이유

슬래시는 현재도 라벨과 별개 노드임:
- 라벨: `labeledWrap` 내부
- 슬래시: chunk 끝의 별도 요소

이번 수정은 라벨 계산, 밑줄, `computeSvLabels`, 드래그 선택 로직을 건드리지 않고  
**separator 렌더 방식만 바꾸는 것**이라 충돌 위험이 매우 낮음.

즉 바뀌는 것은 오직:
- 슬래시 주변 spacing 방식
뿐임.

---

## 구현 계획

### 1) PDF separator 전용 스타일 추가
**파일:** `src/components/PdfDocument.tsx`

- `styles.chunkSlash` 추가
- `styles.englishWord`를 그대로 상속하거나 동일 font 설정 유지
- spacing은 문자열이 아니라 `marginLeft`, `marginRight`로 부여

권장 시작값:
- `marginLeft: 4`
- `marginRight: 4`

필요 시 old look에 더 가깝게:
- `3.5 / 4`
- 또는 `4 / 5`
로 미세 조정

### 2) 슬래시 렌더 방식 변경
현재:
```tsx
{" / "}
```

변경:
```tsx
"/"
```

그리고 스타일로 간격 확보.

### 3) 웹과 PDF를 분리해서 판단
웹 `ChunkEditor.tsx`는 이미 수정됐고, 이번 스크린샷 기준 문제의 본체는 PDF라서
우선은 **PDF만 고치는 게 정확한 수정**임.

원하면 후속으로:
- `ResultDisplay.tsx`
- `ChunkEditor.tsx`

도 separator spacing 전략을 margin 기반으로 통일할 수 있지만,
이번 버그 해결 자체에는 필수 아님.

---

## 왜 “간단하지만 원인분석은 깊어야” 했나

수정 자체는 작음:
- 사실상 `PdfDocument.tsx` 한 군데

하지만 헷갈렸던 포인트가:
- 웹 수정이 이미 들어갔는데도 그대로였고
- 원인이 spacing class가 아니라
- **PDF 엔진의 whitespace 처리 + S/V 도입 후 노드 분할 구조**
였기 때문임.

즉,
- 구현 난도: 낮음
- 원인 분석 난도: 중간 이상

---

## 변경 파일
- `src/components/PdfDocument.tsx` — 슬래시 separator 렌더 방식 수정

선택적 후속 정리:
- `src/components/ResultDisplay.tsx`
- `src/components/ChunkEditor.tsx`

---

## 검증 포인트

1. PDF에서 슬래시 앞뒤 간격이 기능추가 전처럼 균등해 보이는지
2. S/V 라벨 위치가 그대로인지
3. 줄바꿈 시 슬래시가 이상한 위치로 밀리지 않는지
4. 페이지 수 변화가 없는지
5. 웹 화면은 기존 동작 유지되는지

