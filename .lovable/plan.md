

## PDF 수정: 글씨체 변경 + 정렬 + 위첨자 조정

### 1. 영어 글씨체를 Noto Serif로 변경

Pretendard 폰트 등록을 Noto Serif로 교체하고, `englishText`와 `passageText`의 `fontFamily`를 변경.

```text
Font.register({
  family: "Noto Serif",
  src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-serif@latest/latin-400-normal.ttf",
});
```

| 스타일 | 변경 전 | 변경 후 |
|--------|---------|---------|
| 폰트 등록 | Pretendard | Noto Serif |
| `englishText.fontFamily` | `"Pretendard"` | `"Noto Serif"` |
| `passageText.fontFamily` | `"Pretendard"` | `"Noto Serif"` |

### 2. sentenceNumber와 englishText 윗라인 정렬

두 요소 모두 동일한 `fontSize: 8`, `lineHeight: 2.2`를 사용하되, `sentenceNumber`의 `marginTop`을 `0`으로 설정하여 윗선을 정확히 맞춤.

| 스타일 | 변경 전 | 변경 후 |
|--------|---------|---------|
| `sentenceNumber.fontSize` | `8` | `8` (유지) |
| `sentenceNumber.lineHeight` | `2.2` | `2.2` (유지) |
| `sentenceNumber.marginTop` | `-1` | `0` (제거) |

### 3. passageNumber 위첨자 효과

Original Passage 섹션의 번호가 영어 문장보다 살짝 위에 위치하도록 `passageNumber` 스타일 조정. `fontSize`를 본문보다 작게 유지하고 음수 `marginTop`으로 위로 올림.

| 스타일 | 변경 전 | 변경 후 |
|--------|---------|---------|
| `passageNumber.fontSize` | `7` | `6` |
| `passageNumber.marginTop` | `2` | `-1` |
| `passageNumber.marginRight` | `3` | `1` |

### 수정 파일
- `src/components/PdfDocument.tsx`
