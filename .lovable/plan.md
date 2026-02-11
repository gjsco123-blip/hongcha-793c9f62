

# PDF 출력 스타일 조정

## 현재 값 → 변경 값

| 항목 | 현재 | 변경 |
|------|------|------|
| 영어 문장 (englishText) | 9pt | 7pt |
| 번호 (sentenceNumber) | 9pt | 8pt |
| 직역/의역/홍T/구문 (translationContent) | 8pt | 6pt |
| 직역/의역/홍T/구문 라벨 (translationLabel) | 8pt | 6pt |
| 문장 간 간격 (sentenceContainer marginBottom) | 16pt | 20pt |
| Original Passage 소제목 | 없음 | "Original Passage" 10pt, 볼드 |
| Passage 소제목-지문 간격 (passageSectionTitle marginBottom) | 12pt | 4pt |
| Passage 섹션 상단 여백 (passageSection marginTop/paddingTop) | 24/16pt | 16/8pt |

## 변경 파일

**`src/components/PdfDocument.tsx`** 1개 파일만 수정

1. `englishText.fontSize` → 6
2. `sentenceNumber.fontSize` → 6
3. `translationLabel.fontSize` → 6
4. `translationContent.fontSize` → 6
5. `sentenceContainer.marginBottom` → 20 (문장 간 간격 넓힘)
6. `passageSection`의 `marginTop` → 16, `paddingTop` → 8 (간격 축소)
7. Passage 영역에 "Original Passage" 소제목 `<Text>` 추가 (10pt, 볼드, marginBottom: 4)

## 기술 상세

- 모든 변경은 `styles` 객체의 숫자값 수정 + JSX에 소제목 Text 1줄 추가
- 기존 `passageSectionTitle` 스타일이 이미 정의되어 있으므로 그대로 활용하되 `marginBottom`을 12 → 4로 줄임

