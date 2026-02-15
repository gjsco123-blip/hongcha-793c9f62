

## PDF 숫자-영어문장 윗선 정렬 수정

### 문제
`englishText`에 `lineHeight: 2.2`가 설정되어 있어 텍스트 위에 추가 여백이 생김. 반면 `sentenceNumber`는 기본 `lineHeight: 1.8`(페이지 기본값)을 사용하므로, 두 요소의 텍스트 윗선이 어긋남. 현재 `marginTop: 1`로는 보정이 부족함.

### 해결

**파일:** `src/components/PdfDocument.tsx`

`sentenceNumber`의 `lineHeight`를 `englishText`와 동일한 `2.2`로 맞추고, `marginTop`을 제거하면 두 요소가 같은 lineHeight 기준으로 정렬되어 윗선이 일치함.

| 스타일 | 변경 전 | 변경 후 |
|--------|---------|---------|
| `sentenceNumber.lineHeight` | (없음, 페이지 기본 1.8) | `2.2` |
| `sentenceNumber.marginTop` | `1` | 제거 |

이렇게 하면 숫자와 영어 텍스트가 동일한 lineHeight를 사용하여 첫 줄의 윗선이 정확히 일치합니다.
