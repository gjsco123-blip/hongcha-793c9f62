

## PDF 수정: 숫자 위치 미세조정 + 단어 줄바꿈 방지

### 1. 숫자 위치 조정

**파일:** `src/components/PdfDocument.tsx`

현재 `lineHeight: 2.2`로 맞췄지만 숫자가 너무 위에 붙어 있음. `marginTop`을 소량(약 1~2pt) 추가하여 영어 텍스트 첫 줄 바로 위쪽에 살짝 올라간 정도로 조정.

| 스타일 | 변경 전 | 변경 후 |
|--------|---------|---------|
| `sentenceNumber.marginTop` | (없음) | `1` |

### 2. 단어 중간 줄바꿈(하이픈 분리) 방지

**파일:** `src/components/PdfDocument.tsx`

react-pdf는 기본적으로 긴 단어를 하이픈으로 분리할 수 있음. `Font.registerHyphenationCallback`을 사용하여 하이픈 분리를 비활성화하면 "par-ticularly"처럼 단어가 쪼개지는 현상을 방지할 수 있음.

```text
Font.registerHyphenationCallback(word => [word]);
```

이 한 줄을 폰트 등록 코드 아래에 추가하면, 모든 단어가 분리 없이 통째로 다음 줄로 넘어감.

### 수정 요약

| 위치 | 변경 내용 |
|------|-----------|
| `sentenceNumber` 스타일 | `marginTop: 1` 추가 |
| 폰트 설정 | `Font.registerHyphenationCallback` 추가로 하이픈 분리 비활성화 |

