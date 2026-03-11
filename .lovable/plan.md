

# PDF 미리보기/저장 — 팝업 차단 우회 수정

## 확인된 상태
- `pdfPreviewUrl` 에러는 **해결됨** (페이지 정상 로드 확인)
- 브라우저 콘솔에 에러 없음

## 남은 문제
`handlePreviewPdf`와 `handleExportPdf` 모두 async 작업 후 `window.open()` 호출 → 사용자 클릭 컨텍스트 소멸 → **팝업 차단**

## 수정 방법
클릭 시 **즉시 빈 창을 동기적으로** 열고, PDF 생성 완료 후 해당 창에 data URL을 넣는 방식으로 변경.

### 변경 파일 3개

**`src/hooks/usePdfExport.ts`**
- `exportToPdf`와 `previewPdf` 모두: 함수 시작 시 `const win = window.open("", "_blank")` 호출 → async PDF 생성 → `win.location.href = dataUrl` → 실패 시 `win.close()`

**`src/pages/Preview.tsx`** (lines 193-217)
- `handleExportPdf`와 `handlePreviewPdf` 동일 패턴 적용:
```typescript
const win = window.open("", "_blank"); // 동기적으로 먼저 열기
try {
  const blob = await pdf(doc).toBlob();
  const dataUrl = await blobToDataUrl(blob);
  if (win) win.location.href = dataUrl;
} catch (err) {
  win?.close();
}
```

**`src/pages/Index.tsx`** (lines 547-565)
- `handleExportPdf`: `exportToPdf` 호출 전 빈 창 열기 또는 hook 자체가 처리
- `handlePreviewPdf`: 동일 패턴

총 5곳의 `window.open` 호출을 모두 "빈 창 먼저 열기" 패턴으로 교체.

