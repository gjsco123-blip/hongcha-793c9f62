

## PdfDocument.tsx Noto Serif → Source Serif 4 수정

`src/index.css`와 `tailwind.config.ts`는 이미 변경 완료. `src/components/PdfDocument.tsx`에 Noto Serif가 3곳 남아있어 수정 필요.

### 수정 내용 (`src/components/PdfDocument.tsx`)

**1. Font.register (12~15줄)**
- family: `"Noto Serif"` → `"Source Serif 4"`
- URL을 Source Serif 4 TTF로 변경
- bold(700) 웨이트도 함께 등록

**2. styles.englishText (86줄)**
- `fontFamily: "Noto Serif"` → `fontFamily: "Source Serif 4"`

**3. styles.passageText (134줄)**
- `fontFamily: "Noto Serif"` → `fontFamily: "Source Serif 4"`

### 수정 파일
- `src/components/PdfDocument.tsx` (1개 파일, 3곳 수정)
