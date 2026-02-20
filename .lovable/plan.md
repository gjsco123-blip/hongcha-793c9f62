

## Preview PDF 세부 디자인 정교화

### 수정 파일
- `src/components/PreviewPdf.tsx`

### 변경 사항

#### 1. 섹션 제목 (secTitle)
- letterSpacing: 1 → 0.5 (과도한 자간 축소)
- fontSize: 7 → 8 (가독성 확보)
- marginBottom: 6 → 8

#### 2. Vocabulary 테이블 글씨 키우기
- vWord: 6.5pt → 8pt
- vMeaning: 6pt → 7.5pt
- vPos: 5pt → 6pt
- vNum: 5pt → 6pt
- vHdrText: 5pt → 6pt
- vocabRow paddingVertical: 2 → 3
- vWord width: 50 → 58 (긴 단어 대응)

#### 3. Structure 번호 크기 조정
- stepNum: 9pt 700 → 8pt 700 (본문과 동일 크기로 통일)
- stepText: 8pt → 8pt 유지
- stepNum width: 14 → 12

#### 4. Topic/Title/Summary 크기 통일
- fieldLabel: 5.5pt → 7pt (라벨 가독성 확보)
- fieldEn: 9pt 유지
- fieldEnBold (Title): 11pt → 9.5pt, fontWeight 700 유지 (크기 차이 최소화, 볼드로만 구분)
- fieldKo: 7.5pt → 8pt (85-90% 비율 준수)
- fieldLabel marginTop: 6 → 10 (필드 간 간격 확보)

#### 5. Key Summary
- summaryLine: 7.5pt → 8pt, lineHeight 1.8 유지
- summaryBox borderLeftWidth: 1.5 → 2 (웹과 동일하게 약간 굵게)

#### 6. 섹션 구분선
- thinRule marginVertical: 10 → 14 (섹션 간 호흡 확보)

#### 7. 페이지 여백
- paddingTop: 32 → 36 (상단 여백 약간 확대)
- paddingBottom: 24 → 30

### 요약
글씨 크기를 전체적으로 7.5-9pt 범위로 통일하고, 섹션 제목의 과도한 자간을 줄이며, 구분선 전후 여백을 넓혀서 웹 화면과 동일한 단정하고 절제된 느낌을 구현합니다.
