

## PDF 생성 방식 전환 및 여백 개선

### 현재 문제점

1. **html2canvas 방식의 한계**
   - HTML을 이미지로 변환 후 PDF에 삽입 → 화질 저하 (래스터화)
   - 페이지별 여백 적용이 어려움 (이미지를 자르는 방식)
   - 텍스트가 선명하지 않음

2. **첫 페이지 상단 여백**
   - 제목("하홍차는 귀여워")이 상단에서 30mm에 위치해야 함
   - 현재는 용지 가운데쯤에 있음

3. **모든 페이지 상하 여백 30mm**
   - 현재 방식으로는 각 페이지별로 여백 적용 불가

---

### 해결 방안: @react-pdf/renderer 사용

**html2canvas + jsPDF** → **@react-pdf/renderer**로 전환

| 항목 | 현재 (html2canvas) | 변경 후 (@react-pdf/renderer) |
|------|-------------------|------------------------------|
| 렌더링 방식 | HTML → 이미지 → PDF | React 컴포넌트 → 직접 PDF |
| 화질 | 래스터 (픽셀) | 벡터 (무손실) |
| 텍스트 | 이미지화됨 | 실제 텍스트 (검색/복사 가능) |
| 페이지 여백 | 적용 어려움 | CSS-like 스타일로 완벽 제어 |
| 한글 지원 | 웹폰트 의존 | TTF 폰트 직접 등록 |

---

### 구현 계획

#### 1. 패키지 설치

```
@react-pdf/renderer
```

#### 2. 한글 폰트 등록

```typescript
import { Font } from '@react-pdf/renderer';

// Nanum Gothic 폰트 등록 (TTF 형식, 한글 지원)
Font.register({
  family: 'Nanum Gothic',
  src: 'https://fonts.gstatic.com/s/nanumgothic/v23/PN_3Rfi-oW3hYwmKDpxS7F_D_g.ttf',
});
```

#### 3. PDF 문서 컴포넌트 생성

**새 파일: `src/components/PdfDocument.tsx`**

```typescript
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: '30mm',      // 상단 여백 30mm
    paddingBottom: '30mm',   // 하단 여백 30mm
    paddingLeft: '20mm',
    paddingRight: '20mm',
    fontFamily: 'Nanum Gothic',
    fontSize: 9,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  // ...
});

export function PdfDocument({ results, title, subtitle }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        
        {/* 문장들 - 자동 페이지 분할 */}
        {results.map((result, index) => (
          <View key={result.id} wrap={false}> {/* wrap={false} = 잘리지 않음 */}
            <Text>{String(index + 1).padStart(2, '0')} {result.original}</Text>
            <Text>직역: {renderChunks(result.koreanLiteralChunks)}</Text>
            <Text>의역: {result.koreanNatural}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
```

#### 4. PDF 내보내기 훅 수정

**수정 파일: `src/hooks/usePdfExport.ts`**

```typescript
import { pdf } from '@react-pdf/renderer';
import { PdfDocument } from '@/components/PdfDocument';

export function usePdfExport() {
  const exportToPdf = async (results, title, subtitle, filename) => {
    const blob = await pdf(
      <PdfDocument results={results} title={title} subtitle={subtitle} />
    ).toBlob();
    
    // 다운로드
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  return { exportToPdf };
}
```

#### 5. Index.tsx 수정

- `printRef` 제거 (더 이상 HTML 참조 불필요)
- `PrintableWorksheet` 컴포넌트 제거 (숨겨진 HTML 불필요)
- `exportToPdf` 호출 시 데이터 직접 전달

---

### 주요 장점

1. **화질 개선**: 벡터 기반으로 무한 확대해도 선명함
2. **텍스트 검색 가능**: PDF 내 텍스트 검색/복사 가능
3. **완벽한 여백 제어**: 모든 페이지에 동일한 30mm 여백
4. **자동 페이지 분할**: `wrap={false}`로 문장 세트가 잘리지 않음
5. **파일 크기 감소**: 이미지 없이 텍스트만 저장

---

### 수정 파일 요약

| 파일 | 작업 |
|------|------|
| package.json | @react-pdf/renderer 패키지 추가 |
| src/components/PdfDocument.tsx | 새로 생성 - PDF 문서 컴포넌트 |
| src/hooks/usePdfExport.ts | @react-pdf/renderer 방식으로 전면 수정 |
| src/pages/Index.tsx | printRef 제거, 숨겨진 HTML 제거, 호출 방식 변경 |
| src/components/PrintableWorksheet.tsx | 삭제 가능 (더 이상 불필요) |

