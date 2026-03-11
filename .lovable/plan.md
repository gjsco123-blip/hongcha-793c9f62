

# PDF 미리보기 빈 화면 수정 — Blob URL → Data URL 변환

## 원인
Lovable 미리보기 환경의 sandboxed iframe 내부에서 `URL.createObjectURL(blob)`로 만든 Blob URL을 **중첩 iframe의 src**에 넣으면, 보안 정책상 로드가 차단되어 빈 화면이 됨.

## 해결
Blob을 **Base64 Data URL**로 변환하여 iframe src에 사용. Data URL은 별도 네트워크 요청이 아니므로 sandbox 제한을 받지 않음.

## 변경

### `src/pages/Preview.tsx`
- `handlePreviewPdf`: blob → `FileReader.readAsDataURL()` → data URL을 state에 저장
- iframe src에 data URL 사용
- `closePdfPreview`에서 `URL.revokeObjectURL` 제거 (data URL은 revoke 불필요)

### `src/pages/Index.tsx`
- 동일 패턴 적용 (미리보기 모달이 있는 경우)

### 핵심 코드
```typescript
const handlePreviewPdf = async () => {
  const blob = await pdf(doc).toBlob();
  const reader = new FileReader();
  reader.onloadend = () => setPdfBlobUrl(reader.result as string);
  reader.readAsDataURL(blob);
};
```

