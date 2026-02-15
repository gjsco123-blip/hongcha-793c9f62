

## 영어 폰트 변경: Noto Serif → Source Serif 4

### 변경 내용

Google Fonts에서 제공하는 Source Serif 4로 교체합니다.

### 수정 파일

**1. `src/index.css`** - Google Fonts import URL 변경
- `Noto+Serif:wght@400;500;600;700` → `Source+Serif+4:wght@400;500;600;700`

**2. `tailwind.config.ts`** - 폰트 패밀리 이름 변경
- `serif` / `english` 항목: `"Noto Serif"` → `"Source Serif 4"`

**3. `src/components/PdfDocument.tsx`** - PDF용 폰트 등록 변경
- `Font.register` 에서 Noto Serif 대신 Source Serif 4 TTF 경로로 교체
- family 이름을 `"Source Serif 4"`로 변경
- `styles.englishText`, `styles.passageText` 등에서 fontFamily 업데이트

### 영향 범위
- 웹 화면의 영어 텍스트 전체
- PDF 출력의 영어 텍스트
- 기능 변경 없음, 폰트만 교체

