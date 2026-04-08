

# WORKBOOK 글자 간격 균등화 — 외곽선과의 거리 일정하게

## 문제 분석

이미지를 보면 글자들이 외곽선으로부터의 거리가 **들쭉날쭉**함. 원인은 `@react-pdf/renderer`의 `Text` 컴포넌트가 **좌상단 기준(anchor)**으로 배치되기 때문.

현재 코드는 각 글자의 `(x, y)` 좌표를 경로 위 한 점으로 계산하는데, 이 좌표가 글자의 **중심**이 아니라 **좌상단 모서리**에 적용됨. 그래서:
- 회전 0° (상단 직선): 글자 높이의 절반만큼 위로 밀려 보임
- 회전 90° (우측 직선): 글자 너비만큼 오른쪽으로 밀려 보임
- 곡선 구간: 회전 각도에 따라 offset이 불규칙

## 해결 방법

**글자 중심 보정(centering offset)** 적용:
1. 글자 크기(fontSize: 6.5pt)를 기준으로 글자의 대략적인 너비(~4.5pt)와 높이(~6.5pt)를 추정
2. 각 글자의 회전 각도에 따라 `x`, `y`에서 글자 크기의 절반만큼 역방향으로 보정
3. 이렇게 하면 글자의 **시각적 중심**이 경로 위에 놓이게 되어 외곽선과의 거리가 균일해짐

```text
보정 공식:
  adjustedX = x - (charWidth/2) * cos(rotation) - (charHeight/2) * sin(rotation)  
  adjustedY = y - (charWidth/2) * sin(rotation) + (charHeight/2) * cos(rotation)
```

추가로 글자 간 **간격을 넓히기** 위해:
- 경로 범위 확장: `topStartX`를 `cx - 50` (현재 `cx - 30`)으로, `rightEndY`를 `cy + 50` (현재 `cy + 30`)으로 늘림
- 이러면 전체 경로가 길어져서 글자 간 거리가 자연스럽게 넓어짐

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | `getArcLetters()`에서 글자 중심 보정 로직 추가, 경로 범위 확장으로 간격 넓히기 |

