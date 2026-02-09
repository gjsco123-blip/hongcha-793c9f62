

## PDF 스타일 수정: 여백 + 띄어쓰기 + 첨자번호

### 요청사항

1. **첫 페이지 상단 여백**: 10mm
2. **두 번째 페이지 상단 여백**: 15mm
3. **직역/의역 라벨 뒤 띄어쓰기 복원**
4. **지문 첨자번호 진한색으로**

---

### 수정 계획

#### 1. 페이지 여백 조정

| 페이지 | 현재 | 변경 후 |
|--------|------|---------|
| 첫 페이지 | 20mm + 10mm = 30mm | 10mm (28pt) |
| 두 번째 페이지~ | 20mm | 15mm (42pt) |

**구현 방법:**
- 기본 `paddingTop`을 15mm (42pt)로 설정
- 헤더의 `marginTop`을 음수(-14pt, 약 -5mm)로 설정하여 첫 페이지만 10mm 효과

#### 2. 직역/의역 띄어쓰기 복원

현재 코드:
```typescript
<Text style={styles.translationLabel}>직역</Text>
{renderChunksWithSlash(result.koreanLiteralChunks)}
```

수정 후:
```typescript
<Text style={styles.translationLabel}>직역  </Text>
{renderChunksWithSlash(result.koreanLiteralChunks)}
```
- 라벨 텍스트 뒤에 공백 1칸 추가

#### 3. 지문 첨자번호 진한색

현재 `passageNumber` 스타일에 `fontWeight: 700`은 있지만 색상이 명시되지 않음.

수정:
```typescript
passageNumber: {
  fontWeight: 700,
  fontSize: 7,
  verticalAlign: 'super',
  marginRight: 2,
  color: '#000',  // 진한 검정색 추가
},
```

---

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| src/components/PdfDocument.tsx | 1. `paddingTop: 42` (15mm)<br>2. `header.marginTop: -14` (첫 페이지 10mm 효과)<br>3. 직역/의역 라벨 뒤 공백 추가<br>4. `passageNumber`에 `color: '#000'` 추가 |

---

### 수정할 코드

**스타일 변경:**
```typescript
const styles = StyleSheet.create({
  page: {
    paddingTop: 42,      // 15mm - 기본 상단 여백 (두 번째 페이지~)
    // ...
  },
  header: {
    marginTop: -14,      // 첫 페이지만 10mm 효과 (42-14=28pt ≈ 10mm)
    // ...
  },
  passageNumber: {
    fontWeight: 700,
    fontSize: 7,
    verticalAlign: 'super',
    marginRight: 2,
    color: '#000',       // 진한 검정색
  },
});
```

**직역/의역 띄어쓰기:**
```typescript
<Text style={styles.translationLabel}>직역 </Text>
<Text style={styles.translationLabel}>의역 </Text>
```

---

### 예상 결과

- **첫 페이지**: 상단 10mm → 헤더 → 문장들
- **두 번째 페이지~**: 상단 15mm → 문장들
- **직역/의역**: 라벨 뒤 공백 있음
- **지문 첨자**: 진한 검정색

