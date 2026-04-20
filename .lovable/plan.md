
문제는 단순 레이아웃보다는 “Lovable 오른쪽 프리뷰 안의 또 다른 PDF iframe” 구조 자체에 있을 가능성이 가장 큽니다. 지금 코드상 Preview와 Index 모두 최종적으로 data URL을 iframe에 넣고 있고, published 사이트에서는 되는데 Lovable 프리뷰에서만 안 보인다면, 네이티브 PDF 뷰어가 sandbox/nested iframe 환경에서 안정적으로 동작하지 않는 쪽으로 보는 게 맞습니다. 예전에 “안된다”가 반복된 이유도 이 방식 자체가 환경 의존적이기 때문일 가능성이 큽니다.

그래서 이번엔 임시 땜빵이 아니라, 아예 브라우저의 PDF 플러그인/iframe 렌더링에 의존하지 않는 방향으로 한 번에 고치는 계획으로 가는 게 맞습니다.

1. 공통 원인 정리
- `src/pages/Preview.tsx`와 `src/pages/Index.tsx`의 미리보기 모달은 거의 동일함
- 둘 다 현재는 `<iframe src={dataUrl}>` 방식
- 프로젝트 메모에도 “Data URL로 우회” 규칙이 있으나, 지금 환경에서는 그것만으로 부족한 상태
- 즉, data URL 생성 자체보다 “iframe 안 PDF 표시”가 취약점

2. 해결 전략
- PDF를 iframe에 넣지 않고, 앱 내부에서 직접 렌더링하는 전용 PDF preview viewer로 교체
- 생성된 `Blob` 또는 `Uint8Array`를 받아서 `pdf.js` 기반 캔버스/페이지 렌더 방식으로 표시
- 이렇게 하면 Lovable 프리뷰와 published 사이트가 같은 렌더링 경로를 쓰게 되어 환경 차이가 크게 줄어듦

3. 구현 범위
- 새 공용 컴포넌트 추가: 예) `src/components/pdf/PdfPreviewDialog.tsx`
- 역할:
  - 상단 헤더(제목, 다운로드, 닫기)
  - 로딩 상태
  - 페이지 수 표시
  - 각 페이지를 캔버스로 렌더
  - 에러 상태 표시
- `src/pages/Preview.tsx`
  - `pdfBlobUrl` 상태를 URL 문자열 대신 실제 `Blob` 또는 `Uint8Array` 중심으로 변경
  - `handlePreviewPdf`에서 `pdf(doc).toBlob()` 결과를 viewer로 전달
- `src/pages/Index.tsx`
  - 같은 viewer 재사용하도록 통일
- 필요 시 `usePdfExport.ts`에도 preview용 반환 타입을 보조 함수로 정리

4. 왜 이 방식이 더 확실한지
- 브라우저 내장 PDF 플러그인 의존 제거
- sandbox iframe / nested iframe / data URL 표시 제한 영향 최소화
- Preview와 Index의 동작을 공통 컴포넌트로 묶어서 이후 유지보수 쉬워짐
- “웹에서는 되고 Lovable 프리뷰에서는 안 되는” 환경 차이를 줄일 수 있음

5. 세부 작업 순서
- `pdf.js` 렌더러 도입
- 공통 PDF preview dialog 컴포넌트 작성
- Preview 페이지 연결
- Index 페이지도 동일 viewer로 전환
- 다운로드 버튼은 기존 object URL 다운로드 방식 유지
- 기존 iframe 기반 코드 제거 또는 fallback으로만 남김

6. 안전장치
- 렌더 실패 시 모달 안에 명확한 에러 메시지 표시
- 첫 페이지라도 반드시 보이게 하고, 다중 페이지는 세로 스택으로 렌더
- 로딩 중 스피너/텍스트 표시
- 메모리 누수 방지를 위해 문서/worker 정리

7. 검증 계획
- Lovable 오른쪽 프리뷰에서 Preview 페이지 → PDF 미리보기 클릭 → 실제 페이지가 보이는지
- 같은 데이터로 Index 페이지 PDF 미리보기 확인
- 다운로드는 계속 정상인지 확인
- 페이지가 여러 장일 때 스크롤 렌더 정상인지 확인
- published 사이트에서도 동일 viewer가 깨지지 않는지 확인

8. 기술 메모
- 이번 수정의 핵심은 CSS 보정이 아니라 렌더링 방식을 바꾸는 것
- `DialogContent`에 `flex` 추가 같은 보정은 함께 넣을 수 있지만, 메인 해결책으로 보지 않음
- 기존 방식은 “운 좋으면 보이고 환경 따라 깨질 수 있는 구조”, 새 방식은 “앱이 직접 그림”이라 더 안정적

9. 예상 변경 파일
- `src/pages/Preview.tsx`
- `src/pages/Index.tsx`
- `src/components/pdf/PdfPreviewDialog.tsx` 신규
- 필요 시 `package.json` 의존성 추가

10. 최종 목표
- 사용자가 Lovable 오른쪽 프리뷰 안에서 바로 PDF 내용을 보고 검수할 수 있게 만들기
- 퍼블리시 후 별도 사이트 들어가서 확인하는 반복 작업을 없애기
- 이전처럼 부분 수정 후 또 실패하는 게 아니라, 근본적으로 불안정한 iframe PDF preview 방식을 제거하기
