

# WORKBOOK 텍스트 곡선 배치

## 접근 방식

`@react-pdf/renderer`는 SVG `<textPath>`를 지원하지 않으므로, **각 글자를 개별 `<Text>`로 만들어 원호 위 좌표에 배치 + `transform: rotate()`**로 곡선 효과를 구현.

CASETiFY 사진처럼, 워크북 body의 **우측 상단 둥근 모서리(borderRadius: 18)** 안쪽을 따라 "WORKBOOK" 글자가 호를 그리며 배치됨.

## 구현 (`src/components/WorkbookPdfDocument.tsx`)

### 1) 글자별 좌표/회전 계산 함수
```text
function getArcPositions(text: string, cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  // 각 글자를 균등 분배하여 (x, y, rotation) 반환
}
```

### 2) 기존 헤더의 "WORKBOOK" 라벨을 제거
현재 `styles.header` 안의 `<Text style={styles.workbookLabel}>WORKBOOK</Text>` 삭제

### 3) body 내부 우측 상단에 곡선 텍스트 배치
`gridLayer`와 `contentLayer` 사이에 absolute로 위치한 곡선 텍스트 레이어 추가. 각 글자는 `position: absolute`, `left`, `top`, `transform: rotate(Ndeg)`로 배치.

### 4) 스타일
- 폰트: Helvetica Bold, 약 7~8pt
- 색상: #111
- letterSpacing 효과는 각 글자 간 각도 간격으로 조절

## 제약/주의사항
- `@react-pdf/renderer`의 `transform`은 `rotate(Ndeg)` 형식 지원. 단, 회전 중심점(transform-origin) 제어가 제한적이라 미세 조정 필요
- 글자 수가 8개("WORKBOOK")로 고정이므로 하드코딩된 좌표 배열도 실용적

## 수정 파일
| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | 헤더 WORKBOOK 라벨 → body 우측 상단 곡선 배치로 변경 |

