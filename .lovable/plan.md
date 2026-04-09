

# WORKBOOK 좌표를 헤더에서 완전 분리 (Decoupling)

## 핵심 원리

헤더 View에 **고정 높이 상수**를 부여하고, 그 상수를 `getArcPoints()`와 헤더 스타일이 **함께 참조**하게 만든다. 제목 크기가 바뀌어도 헤더 높이는 고정이므로 WORKBOOK 좌표는 절대 변하지 않는다.

## 수정 (`src/components/WorkbookPdfDocument.tsx`)

### 1. 공유 상수 선언

파일 상단(styles 위)에 상수 추가:
```typescript
const HEADER_HEIGHT = 30; // 헤더 영역 고정 높이 (px)
```

### 2. 헤더 스타일에 고정 높이 적용

`styles.header`에 `height: HEADER_HEIGHT` 추가. 제목 fontSize가 바뀌어도 헤더 박스 크기는 불변.

### 3. `getArcPoints()` 수정

`headerHeight = 26` 하드코딩을 제거하고 `HEADER_HEIGHT` 상수를 직접 사용:
```typescript
const bodyTop = pagePadTop + HEADER_HEIGHT;
```

### 결과

- 왼쪽 제목 크기/패딩을 아무리 바꿔도 → 헤더 View 높이 고정 → body 시작점 고정 → WORKBOOK 좌표 불변
- WORKBOOK의 현재 normalOffset(0.8) 및 위치는 전혀 건드리지 않음

## 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/WorkbookPdfDocument.tsx` | 상수 1개 추가, header style 1행, getArcPoints 1행 수정 |

