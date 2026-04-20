

## PDF S/V 라벨이 너무 아래에 뜨는 문제 — 원인과 해결

### 원인
- `englishWord`의 `lineHeight: 2.5` 때문에 단어 텍스트 박스 자체가 **글자 높이의 2.5배**로 부풀려짐 (약 9.5pt × 2.5 ≈ 24pt 박스).
- 라벨 위치를 `top: "100%"`로 잡았기 때문에, 밑줄(글자 baseline 근처) 기준이 아니라 **부풀려진 줄 박스 맨 아래**가 기준이 됨.
- 결과: 라벨이 밑줄에서 약 12~14pt 아래에 떨어져서 다음 줄 영역 근처에 찍힘 → 사용자 사진처럼 보임.

### 해결 방향
라벨 absolute 기준점을 **줄 박스 바닥(현재)** → **밑줄 바로 아래(글자 baseline)** 로 옮긴다.

### 구현
`PdfDocument.tsx`의 라벨 absolute 스타일 변경:

```ts
svLabelAbsolute: {
  position: "absolute",
  // 줄 박스 100%가 아니라 글자 자체 높이만큼만 내려가도록 고정 픽셀 사용
  top: 9.5,        // englishWord fontSize와 동일 (글자 baseline 근방)
  left: 0,
  right: 0,
  marginTop: 0.5,  // 밑줄에서 살짝만 띄움
  fontSize: 6,
  color: "#000",
  textAlign: "center",
  lineHeight: 1,
},
```

핵심 변경:
- `top: "100%"` → `top: 9.5` (englishWord fontSize 값 그대로, lineHeight 영향 차단)
- `marginTop: 1.5` → `0.5` (밑줄에 거의 붙도록)

이렇게 하면 라벨은 **글자 baseline 바로 아래(즉 밑줄에서 아주 가까운 지점)** 에 위치하고, 줄간격 2.5는 그대로 유지되므로 회귀 없음.

### 검증
1. 사진의 `s`, `v`, `s'`, `v'` 라벨이 밑줄 바로 아래에 붙는지
2. 줄간격이 늘어나지 않는지 (페이지 수 동일)
3. 라벨이 밑줄에 너무 붙어 보이면 `marginTop`을 0.5 → 1.0pt 단위로 미세 조정
4. 다음 줄 텍스트와 충돌이 없는지 (lineHeight 2.5의 여유 공간 안에 라벨이 들어가므로 안전)

### 변경 파일
- `src/components/PdfDocument.tsx` — `svLabelAbsolute` 스타일 수정 (한 곳만)

### 참고: 왜 `top: "100%"`가 안 됐나
react-pdf에서 absolute child의 `top: "100%"`는 **부모 박스의 content height** 기준이고, Text의 content height는 `fontSize × lineHeight`로 계산됨. lineHeight가 1.0이면 글자 바로 아래가 100%지만, 2.5면 글자 + 빈 공간 1.5배까지 합친 끝점이 100% → 라벨이 의도보다 한참 아래로 밀려남.

