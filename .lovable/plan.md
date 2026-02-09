
## PDF 레이아웃 개선 및 영어 지문 전용 버전 추가

### 변경 사항 요약

1. **기존 PDF (해석 포함 버전) 개선**
   - 직역/의역 글씨 크기: 11pt → 9pt
   - 문장 간 간격 통일화
   - 라인 높이 조정

2. **새로운 PDF (영어 지문만) 추가**
   - 영어 문장만 표시 (한글 해석 없음)
   - 폰트 크기: 7pt
   - 검은색 원 안에 흰색 숫자 번호

3. **UI 버튼 추가**
   - "PDF 저장" 버튼을 두 가지로 분리
   - "해석 PDF" / "지문 PDF" 선택 가능

---

### 기술적 세부사항

#### 1. PrintableWorksheet.tsx 수정 (해석 포함 버전)

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 직역 fontSize | 11pt | 9pt |
| 의역 fontSize | 11pt | 9pt |
| 문장 블록 간격 | marginBottom: 24pt | marginBottom: 20pt |
| paddingBottom | 16pt | 12pt |
| 영어 → 직역 간격 | marginBottom: 8pt | marginBottom: 6pt |
| 영어 lineHeight | 2 | 1.8 |
| 직역/의역 lineHeight | 2 | 1.6 |

#### 2. PrintableEnglishOnly.tsx 신규 생성

영어 지문만 있는 PDF 컴포넌트:

```text
┌─────────────────────────────────────────────────────┐
│  [UNIT 01]  SYNTAX                    이름: ______  │
│             문장 해석 연습            날짜: ______  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ❶ The discovery of / new species / in the deep    │
│     ocean / has fascinated / scientists / for      │
│     decades.                                        │
│                                                     │
│  ❷ Despite the challenges, / researchers continue  │
│     / to explore / uncharted territories.          │
│                                                     │
│  ❸ ...                                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

스타일 상세:
- 번호: 검은색 원(12pt) 안에 흰색 숫자
- 영어 문장: Noto Serif, 7pt
- 청킹 표시: 슬래시(/)로 구분
- 문장 간격: 균일하게 14pt

#### 3. Index.tsx 수정

- `printEnglishRef` 추가 (영어 지문용 ref)
- PDF 버튼 드롭다운 또는 두 개의 버튼으로 변경:
  - "해석 PDF" - 기존 전체 해석 포함
  - "지문 PDF" - 영어만 포함

#### 4. usePdfExport.ts

기존 훅을 두 개의 ref에서 재사용 가능하도록 유지 (변경 불필요)

---

### 파일별 수정 내용

| 파일 | 작업 |
|------|------|
| src/components/PrintableWorksheet.tsx | 간격 및 폰트 크기 조정 |
| src/components/PrintableEnglishOnly.tsx | 신규 생성 |
| src/pages/Index.tsx | 영어 지문 PDF 버튼 추가, ref 추가 |
