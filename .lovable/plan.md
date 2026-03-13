

# TEXT ANALYSIS 높이 과다 추정으로 인한 페이지 넘김 문제

## 원인

`PASSAGE_CHARS_PER_LINE`이 **85**로 설정되어 있는데, 이 값이 실제보다 너무 작습니다.

- **왼쪽 본문 컬럼** (MEMO 포함): 텍스트 너비 ~403pt → `ENG_CHARS_PER_LINE = 88`
- **TEXT ANALYSIS 박스** (전체 너비): 텍스트 너비 ~475pt → 실제 ~104자/줄

즉, 더 넓은 TEXT ANALYSIS 영역의 `CHARS_PER_LINE`(85)이 더 좁은 본문 컬럼(88)보다 오히려 작게 설정되어 있어, 줄 수가 과다 추정되고 → 높이가 과다 추정되고 → 실제로는 들어갈 공간이 있는데도 다음 페이지로 넘깁니다.

## 해결

`src/lib/pdf-pagination.ts`에서 `PASSAGE_CHARS_PER_LINE`을 85 → **103**으로 수정합니다.

```
계산 근거:
페이지 너비 595.28 - padding 84 - marginRight 8 - boxPadding 28 = 475pt
왼쪽 컬럼: 595.28 - 84 - 8.5 - 100 = 402.78pt → 88자
비율: 88 × (475 / 403) ≈ 103.7 → 103자
```

### 수정 파일
- `src/lib/pdf-pagination.ts` — 1줄 (`PASSAGE_CHARS_PER_LINE: 85` → `103`)

