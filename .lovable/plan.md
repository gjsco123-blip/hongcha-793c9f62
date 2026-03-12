
문제 재현/분석 완료. 이번 건은 “상수 튜닝” 문제가 아니라 **페이지 분할 구조 자체**가 흔들리는 케이스입니다.

1) 업로드 PDF 기준 실제 증상
- 1페이지: 01~04, 하단 여백 큼
- 2페이지: 05만 있고 대부분 빈 페이지
- 3페이지: 06 + TEXT ANALYSIS
- MEMO 높이도 페이지마다 일관되지 않음

2) 근본 원인 (핵심)
- `src/lib/pdf-pagination.ts`의 현재 전략이 `PACKING: 0.80`(의도적 과소추정)이라, “들어간다”로 잘못 판단하는 경우가 발생함.
- 그런데 `PdfDocument`의 `contentRow`는 wrap 가능 상태라, 실제 렌더 시 react-pdf가 내부에서 다시 자동 분할(continuation page)함.
- 즉, **수동 페이지네이션 결과와 실제 렌더 분할이 충돌**해서 “2페이지처럼 계산했는데 3페이지 출력”이 반복됨.
- 추가로 `hFull/hLast` 누적 방식은 페이지 마지막 구분선 계산 오차를 남겨 조기/지연 분할을 유발할 수 있음.

3) 이번에 적용할 해결책 (동시에 처리)
A. 페이지네이션 엔진 안정화 (`src/lib/pdf-pagination.ts`)
- `PACKING < 1` 전략 제거 (과소추정 중단)
- 문장 높이를 “본문 높이”와 “문장 간 separator 높이”로 분리 계산
- `usedHeight` 누적을 separator 포함 방식으로 정확히 재작성 (마지막 문장 separator 오차 제거)
- `PASSAGE_H` 고정값(현재 55) 대신 **TEXT ANALYSIS 동적 높이 추정 함수**로 교체
- `SAFETY`를 0이 아닌 양수로 설정해 렌더 오차 흡수

B. 렌더 분할 잠금 (`src/components/PdfDocument.tsx`)
- `<View style={styles.contentRow} wrap={false}>` 적용
- 이미 `SentenceBlock`은 `wrap={false}`이므로, 상위 row도 고정해 react-pdf의 중간 자동 분할 차단
- 결과적으로 수동 페이지네이션 결과가 그대로 출력되며, MEMO도 해당 row 높이에 맞춰 안정화

C. “첫 페이지 여백 우선 채우기” 보장
- 알고리즘은 그대로 “현재 페이지에 먼저 넣어보고, 넘치면 다음 페이지” 순서 유지
- 단, 판단 기준을 정확화해서 “들어갈 수 있는데 못 넣는” 오차를 제거

4) 기술 상세 (간단)
- 수정 파일:  
  - `src/lib/pdf-pagination.ts` (핵심 로직 재작성)  
  - `src/components/PdfDocument.tsx` (`contentRow wrap={false}` 추가)
- 목표 동작(현재 샘플 기준):  
  - 페이지 구성: `1페이지(01~04)` + `2페이지(05~06 + TEXT ANALYSIS)`  
  - 더 이상 “05만 있는 빈 2페이지” 생성 안 됨  
  - MEMO 하단은 각 페이지 마지막 문장 블록 하단과 일치

5) 검증 기준 (이번 해결 완료 조건)
- 같은 데이터로 새 PDF 생성 시 총 2페이지
- 2페이지에 05/06이 함께 있고 TEXT ANALYSIS가 같은 페이지에 표시
- 중간 continuation 페이지(내용 거의 없는 페이지) 미발생
- MEMO 높이 불일치 재발 없음

실행 순서
1) `pdf-pagination.ts` 로직 재작성
2) `PdfDocument.tsx` row wrapping 잠금
3) 동일 데이터로 PDF 재생성 확인(페이지/배치/MEMO 동시 검증)
