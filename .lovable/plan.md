

# PDF 저장 방식 변경: `window.open`으로 전환

## 변경 내용

`link.click()` 대신 `window.open(url, "_blank")`을 사용하여 iframe 샌드박스 제한을 우회.

## 변경 파일 (2개)

### 1. `src/pages/Preview.tsx` (handleExportPdf)
```typescript
const blob = await pdf(doc).toBlob();
const url = URL.createObjectURL(blob);
window.open(url, "_blank");
// revokeObjectURL은 약간 지연 후 정리
setTimeout(() => URL.revokeObjectURL(url), 30000);
```

### 2. `src/hooks/usePdfExport.ts` (exportToPdf)
동일하게 `window.open` 방식으로 변경.

## 동작
- PDF가 새 탭에서 열리고, 브라우저 내장 PDF 뷰어에서 직접 저장 가능
- iframe 환경에서도 정상 작동

