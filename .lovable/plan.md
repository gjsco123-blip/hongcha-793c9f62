

# PDF 저장/미리보기 — window.open 완전 제거

## 상황
- 배포 사이트에서는 작동하지만 Lovable 미리보기 iframe에서 `window.open`이 차단됨
- sandbox 정책 변경 시점은 불명확하나, 현재 `window.open`은 미리보기에서 신뢰할 수 없음

## 해결: 두 가지 방식으로 교체

### PDF 저장 → `<a download>` 직접 다운로드
```typescript
const blob = await pdf(doc).toBlob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

### PDF 미리보기 → Dialog 모달 + iframe
- `pdfBlobUrl` state 추가
- blob 생성 후 `URL.createObjectURL(blob)` → state에 저장 → Dialog 모달에서 `<iframe src={blobUrl}>` 표시
- 모달 닫을 때 `URL.revokeObjectURL` 호출

## 변경 파일

### 1. `src/hooks/usePdfExport.ts`
- `exportToPdf`: `<a download>` 방식으로 변경
- `previewPdf`: blob URL 문자열을 반환하도록 변경

### 2. `src/pages/Preview.tsx`
- `pdfBlobUrl` state 추가
- `handleExportPdf`: `<a download>` 방식
- `handlePreviewPdf`: blob URL → state → Dialog 모달
- 모달 JSX 추가 (전체 화면 크기, iframe으로 PDF 표시)

### 3. `src/pages/Index.tsx`
- 동일한 패턴 적용

