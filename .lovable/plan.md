
원인 요약
- 지금 변경이 체감되지 않은 핵심 이유는 `PreviewPdf`와 `PdfDocument` 헤더가 “같아 보이지만 실제 렌더 기준이 다르기 때문”입니다.
- Preview는 인라인 스타일 제목, 분석 PDF는 StyleSheet 기반 제목(`lineHeight`, `margin`)이라 텍스트 박스 높이 계산이 달라지고, 같은 `marginTop: 4`라도 제목-라인 간격이 다르게 보입니다.
- 즉, 숫자 하나만 바꿔도 기준 박스가 달라서 시각적으로 “그대로”처럼 보였던 상태입니다.

구현 계획
1) 헤더를 공통 컴포넌트로 통합
- `src/components/pdf/PdfHeader.tsx`(신규) 생성
- 제목 시작 위치, 제목-라인 간격을 “고정 좌표 기반”으로 렌더하도록 설계
- Preview/분석 PDF 둘 다 이 컴포넌트만 사용하게 변경

2) 간격 기준을 폰트 메트릭 의존 → 고정 레이아웃으로 전환
- `header`의 top 시작점 동일화(현재 기준 유지: `paddingTop: 42`, `marginTop: -14`)
- 제목과 라인 간격은 margin 조정이 아니라 고정 블록/고정 오프셋으로 지정
- 예: `titleBoxHeight` + `ruleTopOffset`를 동일 상수로 관리

3) 기존 개별 헤더 스타일 제거
- `PreviewPdf.tsx`의 인라인 헤더 스타일 제거
- `PdfDocument.tsx`의 `title/headerRule` 개별 정의 제거
- 색상만 props로 분리(Preview: #000 계열, 분석: #666 계열), 간격값은 완전 공유

4) 검증 루틴 추가
- 두 PDF를 같은 제목으로 재생성
- “페이지 상단→제목 시작점”, “제목 하단→라인 상단” 2개 거리만 비교
- 값이 동일하면 완료, 아니면 공통 상수 1곳만 조정

기술 세부(변경 파일)
- 수정: `src/components/PreviewPdf.tsx`
- 수정: `src/components/PdfDocument.tsx`
- 추가: `src/components/pdf/PdfHeader.tsx` (공통 헤더)
- 공통 상수 예시: `HEADER_TOP_OFFSET`, `TITLE_RULE_GAP`, `RULE_THICKNESS`

완료 기준
- Preview PDF와 구문분석 PDF에서
  1) 제목 시작 y 위치 동일
  2) 제목-라인 간격 동일
- 이후 동일 이슈 재발 시 공통 헤더 파일 1곳만 수정하면 두 PDF가 동시에 반영됨
