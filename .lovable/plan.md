

# WORKBOOK 곡선 텍스트 — body 바깥쪽 배치

## 현재 문제

글자들이 body 박스 **안쪽**에 배치되어 있음. 사용자는 body의 우측 상단 둥근 모서리 **바깥쪽**을 따라 글자가 나열되길 원함 (CASETiFY 케이스 외곽 느낌).

## 핵심 변경

현재 곡선 텍스트가 `<View style={styles.body}>` 안에 있는데, body 바깥으로 옮겨야 함. body에 `overflow: "hidden"`이 있어 바깥 글자가 잘리기 때문.

### 구현 (`src/components/WorkbookPdfDocument.tsx`)

**1) 곡선 텍스트를 body 밖으로 이동**

현재 arc 글자들이 body View 내부에 렌더링됨 → body **밖**, page 레벨의 별도 절대 위치 레이어로 이동.

**2) 좌표 재계산**

body 좌표 기준이 아니라 page 기준으로 변경:
- body는 page의 `paddingLeft: 30`, header 높이(약 20pt) 아래에서 시작
- body 너비: 535pt, borderRadius: 18pt
- 우측 상단 모서리 곡선 중심 (page 기준): `x ≈ 547, y ≈ 50`
- 글자를 모서리 **바깥**에 배치하므로 radius를 borderRadius(18)보다 큰 값으로: **약 30~35pt**
- 각도 범위: `-80°`(위쪽) → `0°`(오른쪽) 정도

```text
cx: 547   (30 + 535 - 18 = 페이지 기준 모서리 곡선 중심 x)
cy: 50    (header 높이 + body borderRadius 중심 y)
radius: 32 (18pt 모서리 + 14pt 바깥 여백)
startAngle: -80
endAngle: 0
```

**3) JSX 구조 변경**

```text
<Page>
  <View style={header}>...</View>
  <View style={body}>
    {/* gridLayer */}
    {/* contentLayer */}
  </View>
  {/* 곡선 텍스트: body 바깥, page 레벨에서 절대 위치 */}
  {arcLetters.map(...)}
</Page>
```

### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | arc 텍스트를 body 밖으로 이동, 좌표를 page 기준으로 재계산 |

