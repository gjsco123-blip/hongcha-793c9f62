

# PDF 인쇄 흐림 개선: Pretendard OTF → TTF 전환

## 원인
현재 PDF에서 Pretendard를 **OTF**(CFF 기반) 포맷으로 사용 중. OTF는 프린터 드라이버가 래스터화할 때 힌팅이 약해 전체적으로 흐릿하게 인쇄됨. TTF(TrueType)는 힌팅이 강해서 인쇄 선명도가 높음.

추가로 `PreviewPdf.tsx`의 SourceSerif4, Jua가 `@latest`로 되어 있어 버전도 고정 필요.

## 변경 내용

### 1. `src/components/PdfDocument.tsx` — Pretendard 폰트 URL 변경
```
Pretendard-Regular.otf → Pretendard-Regular.subset.woff (X, react-pdf는 woff 미지원)
```
실제로는 Pretendard CDN에 TTF가 없으므로, **Pretendard-JP** 또는 fontsource 경로에서 TTF를 사용하거나, `pretendard-std` 패키지의 TTF를 사용.

확인 필요: CDN에서 Pretendard TTF 경로 존재 여부 → 없으면 대안 폰트(Noto Sans KR TTF) 검토.

### 2. `src/components/PreviewPdf.tsx` — 동일 변경 + 버전 고정

## 수정 파일
- `src/components/PdfDocument.tsx`
- `src/components/PreviewPdf.tsx`

