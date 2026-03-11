

# 구문분석(Index) 페이지에 PDF 미리보기 + 저장 수정

## 현재 상태
- 구문분석 페이지(`Index.tsx`)에는 "PDF 저장" 버튼만 있고, 미리보기 기능 없음
- 저장도 `blob:` URL 방식이라 iframe 환경에서 차단됨
- Preview 페이지에는 이미 미리보기 모달이 구현되어 있음

## 변경 내용

### 1. `src/hooks/usePdfExport.ts` — data URL fallback 추가
- 기존 `<a download>` 시도 후, `FileReader`로 data URL 변환 → `window.open`으로 새 탭 열기
- 새 함수 `previewPdf` 추가: blob → data URL 변환 후 URL 반환 (미리보기용)

### 2. `src/pages/Index.tsx` — PDF 미리보기 버튼 + 모달 추가
- "PDF 저장" 버튼 옆에 "PDF 미리보기" 버튼 추가 (Eye 아이콘)
- Preview 페이지와 동일한 전체화면 모달 (`<iframe>` + data URL)
- 상태: `pdfPreviewUrl`, `pdfGenerating`

### 3. `src/pages/Preview.tsx` — blob URL → data URL로 변경
- `handlePreviewPdf`: blob을 data URL로 변환하여 iframe에 표시
- `handleExportPdf`: 기존 방식 + data URL fallback 추가
- `closePdfPreview`: `revokeObjectURL` 호출 제거 (data URL이므로 불필요)

## 동작
- 미리보기 클릭 → PDF를 data URL로 생성 → 모달에서 바로 확인
- 저장 클릭 → 직접 다운로드 시도 + 새 탭 fallback

