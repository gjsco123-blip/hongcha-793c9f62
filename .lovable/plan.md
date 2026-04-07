

# WORKBOOK 곡선 텍스트 — CASETiFY 스타일 외곽 밀착 배치

## 현재 상태

`getArcLetters()`가 page 레벨에서 절대 위치로 글자를 배치하고 있지만, 좌표 계산의 기준점(cx, cy)과 radius가 body의 실제 borderRadius 곡선과 정확히 일치하지 않아 글자들이 곡선을 제대로 따르지 못함.

## CASETiFY 레퍼런스 분석

- 글자가 둥근 모서리 **바깥 테두리에 밀착**
- 각 글자 중심이 곡선 위에 정확히 위치
- 글자 방향 = 해당 지점의 **법선 방향** (곡선 접선에 수직)
- 글자 간 **각도 간격이 균등**

## 핵심 수정 (`src/components/WorkbookPdfDocument.tsx`)

### 1) 정확한 기준점 계산

body의 top-right borderRadius(18pt)의 곡선 중심을 page 좌표로 정확히 계산:

```text
page paddingLeft: 30
page paddingTop: 30
header 높이: title(8pt) + paddingBottom(6pt) ≈ 14pt

body 시작 Y (page 기준): 30 + 14 = 44 (대략)
body 너비: 595 - 30 - 30 = 535
body 우측 끝 X: 30 + 535 = 565

borderRadius 중심 (page 기준):
  cx = 565 - 18 = 547
  cy = 44 + 18 = 62
```

### 2) radius를 borderRadius에 밀착

CASETiFY처럼 테두리 바로 바깥에 글자를 놓으려면:
- body borderRadius = 18pt
- 글자 중심까지의 거리 = 18 + border두께(0.6) + 글자크기절반(~4) ≈ **23pt**
- 즉 `radius ≈ 23` (현재 32는 너무 멀음)

### 3) 각도 범위 조정

CASETiFY 이미지에서 글자가 우측 변~하단 곡선을 따라가듯, 워크북에서는 **상단 변 → 우측 변**을 따라가야 함:
- startAngle: **-85°** (거의 위쪽, 상단 변 근처)
- endAngle: **-5°** (거의 오른쪽, 우측 변 근처)

### 4) 글자 간격 균등화

현재 8글자를 각도로 균등 분배하고 있는데, 이 방식은 유지. 다만 `fontSize`를 약간 줄이고(6.5~7pt) 각도 범위를 좁혀 글자가 촘촘하게 곡선에 붙도록 조정.

### 5) 미세 조정이 필요한 변수들

실제 PDF 렌더링 결과를 보며 조정해야 할 파라미터:
- `cx`, `cy`: header 높이에 따라 ±2pt
- `radius`: 글자가 테두리에서 얼마나 떨어지는지
- `startAngle`, `endAngle`: 글자가 곡선의 어디부터 어디까지 분포하는지
- `fontSize`: 글자 크기

→ 한 번에 완벽하기 어려우므로, 첫 적용 후 PDF 확인하며 반복 조정 예상.

## 변경 요약

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | `getArcLetters()` 파라미터 정밀 재계산: cx/cy를 body borderRadius 중심에 맞추고, radius를 23pt로 줄여 밀착, 각도 범위 -85°~-5° |

