

# WORKBOOK 배치 — 근본 원인 수정

## 발견한 버그

`getArcLetters()`의 앵커 보정 공식(294-295행)이 **반시계 방향(CCW) 회전**을 가정하고 있는데, react-pdf의 `rotate(deg)`는 **시계 방향(CW)**임. 회전 0°(상단 직선)에서는 sin(0)=0이라 오차가 없지만, 회전이 커질수록(곡선→우측) 오차가 비례해서 커짐.

이게 바로 "오른쪽으로 갈수록 점점 멀어지는" 원인이야.

### 수학적 증명

```text
현재 공식 (CCW 가정):
  ax = pathX - (w/2)*cos(θ) + (charH/2)*sin(θ)   ← 부호 틀림
  ay = pathY - (w/2)*sin(θ) - (charH/2)*cos(θ)   ← 부호 틀림

올바른 공식 (CW):
  ax = pathX - (w/2)*cos(θ) - (charH/2)*sin(θ)   ← sin 항 부호 반전
  ay = pathY + (w/2)*sin(θ) - (charH/2)*cos(θ)   ← sin 항 부호 반전

θ=0° → sin=0이므로 두 공식 동일 (상단 W,O,R 정상)
θ=90° → 차이 = charH = 6.5pt (BOOK이 6.5pt나 멀어짐!)
θ=45° → 차이 ≈ 4.6pt (곡선 구간 K도 영향)
```

이게 바로 이미지에서 보이는 "K→B→O→O→K 갈수록 점점 멀어지는" 현상의 정확한 원인.

## 변경 내용 (`src/components/WorkbookPdfDocument.tsx`)

### 1. 앵커 보정 공식 부호 수정 (294-295행)

```typescript
// 현재 (버그)
let ax = pathX - (m.w / 2) * Math.cos(rad) + (charH / 2) * Math.sin(rad);
let ay = pathY - (m.w / 2) * Math.sin(rad) - (charH / 2) * Math.cos(rad);

// 수정 (CW 회전 기준)
let ax = pathX - (m.w / 2) * Math.cos(rad) - (charH / 2) * Math.sin(rad);
let ay = pathY + (m.w / 2) * Math.sin(rad) - (charH / 2) * Math.cos(rad);
```

### 2. borderPush 값 리셋 후 최소화

공식이 올바르면 모든 글자가 같은 거리에 놓이므로, borderPush는 둥근 글자의 미세 보정만 남김:

```text
인덱스  글자  현재    →  새 값
  0     W    0.2       0.1
  1     O    0.8       0.4
  2     R    0         0      ← 기준
  3     K    0         0
  4     B    0.7       0.3
  5     O    0.8       0.4
  6     O    0.8       0.4
  7     K    0         0
```

## 왜 이게 해결책인가

- 지금까지 borderPush로 보정하려 했던 건 **6.5pt짜리 공식 버그**를 **0.몇pt 단위**로 메꾸려는 것이었음
- 부호 2개만 고치면 모든 글자가 구조적으로 동일 거리에 배치됨
- borderPush는 이후 둥근 글자(O, B)의 시각적 미세 차이만 보정하면 됨

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | 앵커 공식 부호 수정 (2행) + borderPush 값 조정 (8행) |

