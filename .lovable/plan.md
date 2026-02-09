

## PDF 폰트 URL 수정

### 문제 원인

`@react-pdf/renderer`에서 등록한 폰트 URL이 모두 **404 Not Found** 에러 반환:

| 폰트 | 현재 URL | 상태 |
|------|----------|------|
| Nanum Gothic (400) | fonts.gstatic.com/s/nanumgothic/v23/... | 404 에러 |
| Nanum Gothic (700) | fonts.gstatic.com/s/nanumgothic/v23/... | 404 에러 |
| Noto Serif | fonts.gstatic.com/s/notoserif/v23/... | 404 에러 |

### 해결 방안

Google Fonts EA (East Asian) 저장소의 올바른 TTF URL로 변경:

```text
수정 파일: src/components/PdfDocument.tsx

변경 내용:
- Nanum Gothic → Google EA 저장소 URL 사용
  https://fonts.gstatic.com/ea/nanumgothic/v5/NanumGothic-Regular.ttf
  https://fonts.gstatic.com/ea/nanumgothic/v5/NanumGothic-Bold.ttf

- Noto Serif → Noto Sans로 변경 (영문도 산세리프로 통일)
  또는 올바른 Noto Serif URL 사용
  https://cdn.jsdelivr.net/fontsource/fonts/noto-serif@latest/latin-400-normal.ttf
```

### 수정할 코드

```typescript
// 한글 폰트 - EA 저장소 사용
Font.register({
  family: 'Nanum Gothic',
  fonts: [
    { 
      src: 'https://fonts.gstatic.com/ea/nanumgothic/v5/NanumGothic-Regular.ttf', 
      fontWeight: 400 
    },
    { 
      src: 'https://fonts.gstatic.com/ea/nanumgothic/v5/NanumGothic-Bold.ttf', 
      fontWeight: 700 
    },
  ],
});

// 영문 폰트 - CDN 또는 로컬 폰트 사용
Font.register({
  family: 'Noto Serif',
  src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-serif@latest/latin-400-normal.ttf',
});
```

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| src/components/PdfDocument.tsx | 폰트 URL을 올바른 EA 저장소 URL로 수정 |

