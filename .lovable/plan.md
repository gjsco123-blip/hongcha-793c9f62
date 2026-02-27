

## Plan: 주아체(Jua) 제목 + 강원교육새음체(GangwonEdu) 홍T 폰트 적용

### 변경 사항

**1. `src/components/PreviewPdf.tsx` — 주아체 폰트 등록 + 제목 적용**
- `Font.register`로 Jua 폰트 추가 (CDN: `https://cdn.jsdelivr.net/fontsource/fonts/jua@latest/korean-400-normal.ttf`)
- 헤더 제목 `<Text>` 스타일에 `fontFamily: "Jua"` 적용

**2. `src/components/PdfDocument.tsx` — 주아체 + 강원교육새음체 폰트 등록 + 적용**
- `Font.register`로 Jua 폰트 추가
- `Font.register`로 GangwonEduSaeeum 폰트 추가 (CDN: `https://cdn.jsdelivr.net/gh/fonts-archive/GangwonEduSaeeum/GangwonEduSaeeum-OTF.otf`)
- 헤더 제목 `title` 스타일에 `fontFamily: "Jua"` 적용
- 홍T 행(line ~430)의 `<Text>` content에 인라인으로 `fontFamily: "GangwonEduSaeeum"` 적용

### 영향 범위
- Preview PDF: 제목만 주아체로 변경
- 분석하기 PDF: 제목 주아체 + 홍T 내용 강원교육새음체로 변경
- 나머지 본문/어휘 등은 기존 Pretendard 유지

