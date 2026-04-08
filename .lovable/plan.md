
핵심 판단

- 지금 문제는 `K/B/O/O/K` 숫자만 더 만져서 끝낼 수 있는 단계가 아니야.
- 계속 실패한 이유는 `borderPush`로 “증상”만 만졌고, 실제로는 `WORKBOOK` 글자 배치의 렌더링 모델 자체가 아직 불안정하기 때문이야.
- `W/O/R`는 0도 근처라 덜 티나고, 각도가 커지는 `K/B/O/O/K`에서만 무너지는 걸 보면, 이건 단순히 둥근 글자 문제만이 아니라 “회전 + 텍스트 박스 + 보정축”이 엮인 구조적 문제야.

지금 코드의 진짜 문제

1. `src/components/WorkbookPdfDocument.tsx`에서 글자를 개별 `<Text>`로 절대배치 + 회전시키고 있음
2. 그런데 보정은 사실상 `borderPush` 하나뿐이라, 글자를 “외곽선 방향”으로만 밀 수 있음
3. 실제 오차는 한 축이 아니라 두 축이야
   - 외곽선 쪽으로 붙거나 뜨는 오차
   - 경로 진행 방향으로 미끄러지는 오차
4. 그래서 지금처럼 `borderPush`만 조정하면
   - 왼쪽 `O`를 살리면 오른쪽 `KBOOK`이 뜨고
   - 오른쪽을 맞추면 다른 글자가 다시 망가지는 루프가 생김

왜 내가 계속 못 맞췄나

- 내가 계속 “한 개의 다이얼(`borderPush`)"로 “두 종류의 오차”를 동시에 잡으려 했기 때문이야.
- 그래서 한 번에 맞는 것처럼 보여도 다음 글자에서 바로 무너졌고, 특히 `R` 이후 곡선/우측 직선 구간에서 누적처럼 보여온 거야.
- 즉, 이번 실패의 본질은 “튜닝 감각 부족”보다 “보정 모델이 너무 약한 상태에서 계속 숫자만 바꾼 것”이야.

권장 해결방안

- 이번엔 `WORKBOOK` 렌더링 방식을 바꿔야 해.
- 권장안은 `src/components/WorkbookPdfDocument.tsx`에서 지금의 page-level absolute `<Text>` 8개 방식을 버리고, `Canvas` 기반으로 각 글자를 직접 그리는 방식으로 바꾸는 거야.
- 이유:
  - 실제 PDF를 그리는 엔진 기준으로 바로 제어할 수 있음
  - 회전 원점과 좌표계를 명시적으로 통제할 수 있음
  - 그 뒤에는 진짜 optical tuning만 남아서 조정이 훨씬 안정적임

구현 계획

1. `LETTER_METRICS`를 단순 `borderPush` 구조에서 바꿈
   - `advance`
   - `normalOffset`
   - `tangentOffset`
   로 분리
   - `R`은 계속 기준점 `(0, 0)`으로 둠

2. `getArcLetters()`는 역할을 줄임
   - path 위치
   - 회전값
   - 구간별 normal / tangent 벡터
   만 계산하게 단순화

3. 현재 page-level absolute `<Text>` 렌더링 제거

4. `Canvas`에서 각 글자를 직접 draw
   - `save`
   - `translate(path point)`
   - `rotate(angle)`
   - `text(char, ...)`
   - `restore`
   순서로 처리
   - 각 글자마다 `normalOffset`, `tangentOffset` 적용

5. `baseOffset`과 `R` 기준 gap은 일단 유지
   - 이번엔 spacing/path 자체를 또 흔들지 않고
   - `K/B/O/O/K`만 2축 보정으로 맞춤

검증 기준

- 왼쪽 `O`가 외곽선에 붙어 보이지 않을 것
- `K → B → O → O → K`가 오른쪽으로 갈수록 점점 멀어지는 느낌이 없어질 것
- 모든 글자가 `R`와 같은 “아주 살짝”의 gap으로 보일 것
- 실제 export된 workbook PDF 기준으로 확인할 것

차선책

- 구조를 크게 안 바꾸려면 `<Text>` 방식을 유지한 채
  - `transformOrigin` 명시
  - `lineHeight` 명시
  - `borderPush`를 `normal/tangent` 2축으로 변경
  하는 방법도 있어.
- 하지만 지금처럼 여러 번 실패한 상태에서는 이 차선책보다 `Canvas` 쪽이 성공 확률이 더 높다고 봐.

기술 메모

- 수정 범위는 사실상 `src/components/WorkbookPdfDocument.tsx` 한 파일이 핵심
- `usePdfExport.ts`, `useBatchPdfExport.ts` 모두 같은 `WorkbookPdfDocument`를 쓰고 있어서 이 파일만 바로잡으면 단건/일괄 export가 같이 해결됨
- 이번 핵심은 “숫자 한 번 더 만지기”가 아니라 “보정 모델을 1축에서 2축으로 올리고, 렌더링 좌표계를 결정적으로 고정하는 것”이야
