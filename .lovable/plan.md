
문제 원인 정확히 짚으면 이거예요:

1) 지금 수정하고 있는 위치는 맞습니다.  
- 파일: `src/components/PdfDocument.tsx`  
- 함수: `renderChunksWithVerbUnderline`  
- 핵심 줄: `const supStyle = { fontSize: 4, verticalAlign: "super", marginTop: -15 }`

2) 그런데 `@react-pdf/renderer`에서는 **inline `<Text>`의 `marginTop`/`verticalAlign: "super"`가 웹처럼 동작하지 않거나 사실상 무시**됩니다.  
그래서 `marginTop`을 더 올려도 화면상 변화가 거의 없어요.

3) 추가로, 위첨자를 별도 `<Text>` 노드로 끼워 넣는 방식이 동사 밑줄 분할과 겹치면, 말씀하신 것처럼 `are` 근처에 어색한 선/막대처럼 보이는 아티팩트가 생길 수 있습니다.

---

구현 계획 (승인 후 적용):

## 1) 위첨자 렌더링 전략 변경 (핵심)
`marginTop`으로 올리는 방식 버리고, **유니코드 위첨자 숫자(¹²³⁴...)**를 직접 넣는 방식으로 변경합니다.

- 새 헬퍼 추가 (같은 파일 내부):
  - `toSuperscriptNumber(id: number): string`
  - 예: `2 -> "²"`, `12 -> "¹²"`

- `renderSup()`를 별도 baseline 이동 스타일 대신:
  - 아주 작은 폰트(예: 5~6pt), lineHeight 1 정도만 주고
  - 텍스트 내용 자체를 유니코드 위첨자로 출력

이렇게 하면 `verticalAlign/marginTop` 엔진 의존성을 제거할 수 있습니다.

## 2) 밑줄 아티팩트 완화
현재 동사(`isVerb`) 분기에서 텍스트를 여러 조각으로 쪼개며 위첨자 `<Text>`를 사이에 넣습니다.  
여기서 seam(경계) 아티팩트가 생길 수 있으니:

- 위첨자 노드에는 `textDecoration`이 절대 적용되지 않게 분리
- 동사 조각 분할 최소화 (필요한 경우만 split)
- 공백/구두점 분리 정규식 적용 위치를 정리해서 불필요한 조각 생성 줄이기

## 3) 위치 매칭 로직은 유지
이미 적용된 offset 기반(`{id, offset}`)은 방향이 맞습니다.  
즉, 이번 수정은 “위치 계산”이 아니라 “위치 표시 방식(렌더러 호환)”을 바꾸는 작업입니다.

## 4) 검증 시나리오
- 케이스 A: 일반 텍스트 세그먼트 중간 시작 (`larger than`)
- 케이스 B: 동사 세그먼트 시작/중간
- 케이스 C: 문장 맨 앞/슬래시(` / `) 직후
- 웹/ PDF 동일 위치 비교 캡처 확인

---

기술 상세 (비개발자도 볼 수 있게 쉽게 설명)

- 지금은 “작은 숫자를 CSS처럼 위로 올리기”를 시도 중인데, PDF 엔진이 그 CSS를 제대로 안 먹습니다.
- 그래서 “원래부터 위에 붙어있는 숫자 글자(¹²³)” 자체를 써야 안정적으로 보입니다.
- 즉, “스타일로 올리는 방식” → “글자 자체가 위첨자인 방식”으로 바꾸면 해결됩니다.

---

수정 대상 파일
- `src/components/PdfDocument.tsx`  
  - `renderChunksWithVerbUnderline` 내부 `renderSup`/`supStyle`
  - 위첨자 숫자 변환 헬퍼 추가
  - 동사 분기 split 정리

<lov-actions>
<lov-suggestion message="PDF를 다시 생성해서 웹 화면과 비교해 위첨자 높이/위치, are 주변 밑줄 아티팩트까지 end-to-end로 검증해줘">끝단 테스트 먼저 진행</lov-suggestion>
<lov-suggestion message="PdfDocument.tsx에서 marginTop/verticalAlign 방식 대신 유니코드 위첨자(¹²³) 렌더링으로 교체해줘">유니코드 위첨자로 교체</lov-suggestion>
<lov-suggestion message="동사 세그먼트 분할 로직을 정리해서 위첨자 삽입 시 밑줄 seam(막대기) 아티팩트가 생기지 않게 리팩터링해줘">밑줄 아티팩트 제거</lov-suggestion>
</lov-actions>
