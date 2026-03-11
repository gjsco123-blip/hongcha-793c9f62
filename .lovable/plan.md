

# PDF 미리보기/저장 수정 — iframe 폐기, 새 탭 방식으로 전환

## 근본 원인
Lovable 미리보기 자체가 **sandboxed iframe** 안에서 실행됨. 이 안에서 또 다른 `<iframe>`에 data URL PDF를 넣으면 브라우저 내장 PDF 뷰어가 작동하지 않아 **빈 화면**이 표시됨. `blob:` URL이든 `data:` URL이든 동일한 문제.

## 해결 방법
인라인 iframe 모달을 **완전히 제거**하고, `window.open(dataUrl, "_blank")`으로 **새 탭**에서 PDF를 열도록 변경. 새 탭은 sandbox 제한이 없으므로 브라우저 PDF 뷰어가 정상 작동함.

## 변경 파일

### 1. `src/pages/Preview.tsx`
- `pdfPreviewUrl`, `pdfGenerating` 상태 및 모달 JSX **전체 제거**
- `handlePreviewPdf`: blob → data URL → `window.open(dataUrl, "_blank")`
- `handleExportPdf`: 동일하게 data URL 새 탭 방식
- 모달 관련 코드 (iframe, closePdfPreview) 삭제
- 버튼 2개 유지: "PDF 미리보기" (새 탭), "PDF 저장" (새 탭)

### 2. `src/pages/Index.tsx`
- 동일한 패턴 적용: 모달 제거, 새 탭 방식으로 변경

### 3. `src/hooks/usePdfExport.ts`
- previewPdf 함수도 새 탭 방식으로 통일

## 동작
1. "PDF 미리보기" 클릭 → PDF 생성 → 새 탭에서 브라우저 PDF 뷰어로 표시
2. "PDF 저장" 클릭 → 동일하게 새 탭에서 열림 (브라우저에서 다운로드 가능)

