

## PDF 레이아웃 수정: 헤더 위치 및 첫 페이지 전용 표시

### 문제점 분석

1. **헤더가 모든 페이지에 반복됨**
   - `@react-pdf/renderer`의 자동 페이지 분할은 `<Page>` 내용을 이어서 렌더링
   - 현재 구조에서는 헤더가 페이지별로 조건부 표시되지 않음

2. **헤더가 30mm보다 더 아래에 위치**
   - `paddingTop: '30mm'`가 적용되어 있지만 렌더링 결과가 다름
   - 단위 문제일 수 있음 (문자열 '30mm' vs 숫자)

---

### 해결 방안

#### 1. 페이지별 조건부 헤더 표시 (`render` prop 사용)

```typescript
// 첫 페이지에만 헤더 표시
<View 
  render={({ pageNumber }) => 
    pageNumber === 1 ? (
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    ) : null
  }
/>
```

#### 2. 여백을 포인트 단위로 변경

`@react-pdf/renderer`에서 mm 단위가 정확히 적용되지 않을 수 있으므로 포인트(pt) 단위로 변경:

```typescript
// 30mm = 약 85pt (1mm ≈ 2.835pt)
const styles = StyleSheet.create({
  page: {
    paddingTop: 85,      // 30mm in points
    paddingBottom: 85,   // 30mm in points
    paddingLeft: 57,     // 20mm in points
    paddingRight: 57,    // 20mm in points
    fontFamily: 'Nanum Gothic',
    fontSize: 9,
    lineHeight: 1.8,
  },
  // ...
});
```

---

### 수정할 코드

```text
수정 파일: src/components/PdfDocument.tsx

변경 내용:
1. page 스타일의 padding을 mm에서 pt로 변경 (30mm → 85pt)
2. 헤더를 render prop으로 감싸서 pageNumber === 1일 때만 표시
3. 두 번째 페이지부터는 헤더 없이 바로 문장 시작
```

---

### 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| src/components/PdfDocument.tsx | 1. padding 단위를 pt로 변경 (정확한 30mm 여백)<br>2. render prop으로 첫 페이지에만 헤더 표시 |

---

### 예상 결과

- **첫 페이지**: 상단 30mm 여백 → 헤더(SYNTAX, 문장해석연습) → 문장들
- **두 번째 페이지 이후**: 상단 30mm 여백 → 바로 문장 시작 (헤더 없음)

