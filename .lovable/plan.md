

# PDF 저장 버튼 → 파일 다운로드 복원

## 문제
PDF 저장 버튼을 누르면 새 탭이 열릴 뿐, 실제 파일로 저장되지 않음.

## 해결
`window.open` 대신 `<a download>` 방식으로 되돌려서, 버튼 클릭 시 PDF 파일이 바로 다운로드되도록 변경.

## 변경 파일

### 1. `src/pages/Preview.tsx` — `handleExportPdf`
blob 생성 후 `<a download>` 링크로 파일 다운로드 트리거.

### 2. `src/hooks/usePdfExport.ts` — `exportToPdf`
동일하게 `<a download>` 방식으로 변경.

