
## PDF 화질 개선 및 동그라미 번호 스타일 개선

### 변경 사항 요약

1. **PDF 화질 대폭 개선**
   - html2canvas scale: 2 → 4 (300 DPI 수준)
   - 고해상도 이미지로 선명한 텍스트 출력

2. **동그라미 번호 CSS 스타일로 변경**
   - 유니코드 문자 → CSS로 만든 완벽한 원
   - 크기 조절 가능 (작게)
   - 일관된 렌더링

---

### 기술적 세부사항

#### 1. usePdfExport.ts 수정 - 화질 개선

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| scale | 2 | 4 |
| 예상 DPI | ~150 DPI | ~300 DPI |

```typescript
const canvas = await html2canvas(element, {
  scale: 4,  // 2 → 4로 변경
  useCORS: true,
  logging: false,
  backgroundColor: "#ffffff",
});
```

#### 2. PrintableWorksheet.tsx 수정 - 동그라미 번호 스타일

**현재 방식 (유니코드 문자):**
```typescript
function getCircledNumber(n: number): string {
  const circled = ["①","②","③",...];
  return n <= 20 ? circled[n - 1] : `(${n})`;
}

// 사용
<span style={{ fontWeight: 600 }}>{getCircledNumber(index + 1)}</span>
```

**변경 후 (CSS 스타일):**
```typescript
// 함수 제거하고 JSX 컴포넌트로 변경
function CircledNumber({ num }: { num: number }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      border: "1px solid #333",
      fontSize: "8px",
      fontWeight: 600,
      marginRight: "3px",
      verticalAlign: "middle",
      lineHeight: 1
    }}>
      {num}
    </span>
  );
}

// 사용
<CircledNumber num={index + 1} />
```

---

### 결과 비교

**동그라미 번호 변경 전:**
```text
① 문장... (유니코드 - 크고 불완전한 원)
```

**동그라미 번호 변경 후:**
```text
⓵ 문장... (CSS - 작고 완벽한 원, 크기 14px)
```

- 완벽한 원형 (borderRadius: 50%)
- 크기: 14px (기존보다 작음)
- 테두리: 1px solid
- 숫자: 8px 폰트

---

### 추가 적용 예정 (이전 승인 사항)

1. **페이지 분할 개선** - 문장 단위로 깔끔하게 분리
2. **지문 섹션 개선** - 슬래시 제거, 양쪽 정렬
3. **헤더 간소화** - UNIT 배지 제거, 제목 커스텀 기능

---

### 파일별 수정 내용

| 파일 | 작업 |
|------|------|
| src/hooks/usePdfExport.ts | scale 4로 증가하여 화질 개선 |
| src/components/PrintableWorksheet.tsx | CircledNumber 컴포넌트로 완벽한 원형 번호 구현 |
