

## PDF 레이아웃 수정: 헤더 복원 + 페이지별 상단 여백 조정

### 현재 문제

1. **헤더가 표시되지 않음**: `render` prop에 `fixed` 속성이 없어서 렌더링 안 됨
2. **두 번째 페이지 상단 여백이 너무 넓음**: 30mm가 모든 페이지에 적용됨

### 해결 방안

#### 페이지별 여백 전략

| 페이지 | 상단 여백 | 내용 |
|--------|----------|------|
| 첫 페이지 | 30mm | 헤더(SYNTAX, 문장해석연습) + 문장들 |
| 두 번째 페이지~ | 20mm | 문장들만 (헤더 없음) |

#### 구현 방법

`@react-pdf/renderer`는 페이지별로 다른 padding을 직접 지원하지 않으므로:

1. 기본 `paddingTop`을 **20mm (57pt)**로 설정
2. 첫 페이지 헤더에 **추가 marginTop 10mm (28pt)**를 적용하여 총 30mm 효과

```text
수정 파일: src/components/PdfDocument.tsx

변경 내용:
1. paddingTop: 85 → 57 (30mm → 20mm)
2. header 스타일에 marginTop 추가로 첫 페이지만 30mm 효과
3. 헤더 View에 fixed 속성 추가하여 render prop 작동하게 함
```

### 수정할 스타일

```typescript
const styles = StyleSheet.create({
  page: {
    paddingTop: 57,      // 20mm - 기본 상단 여백
    paddingBottom: 85,   // 30mm
    paddingLeft: 57,     // 20mm
    paddingRight: 57,    // 20mm
    // ...
  },
  header: {
    marginTop: 28,       // 추가 10mm (총 30mm 효과)
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 12,
  },
  // ...
});
```

### 수정할 JSX

```typescript
<View
  fixed
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

### 예상 결과

- **첫 페이지**: 상단 30mm 여백 → 헤더 → 문장들
- **두 번째 페이지~**: 상단 20mm 여백 → 바로 문장 시작

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| src/components/PdfDocument.tsx | 1. paddingTop 57pt로 변경<br>2. header에 marginTop 28pt 추가<br>3. 헤더 View에 `fixed` 속성 추가 |

