

# PDF 파일명 변경

## 현재 상태
- **Index (구문분석) 페이지**: `syntax-worksheet.pdf` 고정 파일명
- **Preview 페이지**: `{pdfTitle}.pdf` (예: `수능특강 UNIT 1-2.pdf`)

## 변경 내용

### 1. Index 페이지 (`src/pages/Index.tsx`)
파일명을 `{pdfTitle}+구문분석.pdf`로 변경:
```
// line 524
"syntax-worksheet.pdf"  →  `${pdfTitle}+구문분석.pdf`
```

### 2. Preview 페이지 (`src/pages/Preview.tsx`)
파일명을 `{pdfTitle}+preview.pdf`로 변경:
```
// line 194
`${pdfTitle || "preview"}.pdf`  →  `${pdfTitle}+preview.pdf`
```

### 수정 파일
- `src/pages/Index.tsx` — 1줄
- `src/pages/Preview.tsx` — 1줄

