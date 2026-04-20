

## PDF 폰트 에러 수정 — Pretendard Italic 등록 누락

### 원인
PDF 미리보기/저장 실패 메시지:
> Could not resolve font for Pretendard, fontWeight 600, fontStyle italic

방금 추가한 S/V 라벨이 PDF에서 `fontStyle: "italic"` + Pretendard SemiBold(600)를 요구하는데, `PdfDocument.tsx`의 `Font.register`에는 **italic 변형이 등록되어 있지 않음**. react-pdf는 정확한 (family, weight, style) 매칭이 없으면 throw 함.

확인 포인트(읽기 전용으로 검증 예정):
- `PdfDocument.tsx`의 `Font.register({ family: "Pretendard", fonts: [...] })`에 `fontStyle: "italic"` 항목 존재 여부
- S/V 라벨 Text의 style (italic 사용 중)

### 해결책 (3개 옵션)

**A안: italic 제거 (가장 간단, 추천)**
- S/V 라벨에서 `fontStyle: "italic"` 제거
- Pretendard Regular(400) normal로만 렌더 → 추가 폰트 등록 불필요
- 사진 참조용 디자인은 italic 없어도 가독성 충분 (subscript + 작은 크기로 이미 본문과 구분됨)

**B안: italic 폰트 추가 등록**
- Pretendard에는 italic 변형이 없음(공식 패밀리는 roman만)
- Google Fonts CDN에서 Pretendard italic을 못 구함 → 다른 italic 폰트(예: Inter Italic) 추가 등록 필요
- 폰트 번들 크기 증가 + 한 페이지에 두 폰트 패밀리 혼용

**C안: Helvetica Italic 사용 (S/V 라벨만)**
- 라벨에만 react-pdf 내장 Helvetica + italic 적용
- 별도 등록 불필요, 본문 Pretendard와 분리
- 라벨이 본문과 살짝 다른 폰트(산세리프) → 시각적 구분 효과는 있으나 일관성 약간 떨어짐

### 추천: A안
- 라벨은 이미 4.5pt + 회색(#666) + subscript로 본문과 명확히 구분됨
- italic은 시각적 장식일 뿐, 기능적 의미 없음
- 웹 UI도 동일하게 italic 제거하여 PDF/웹 일치

### 변경 파일
- `src/components/PdfDocument.tsx` — S/V 라벨 Text의 `fontStyle: "italic"` 제거
- `src/components/ResultDisplay.tsx` — 라벨 inline style의 `fontStyle: "italic"` 제거 (PDF/웹 일치)
- `src/components/ChunkEditor.tsx` — 동일 처리

### 검증
- PDF 미리보기 정상 동작
- PDF 저장 정상 동작
- 라벨이 여전히 본문과 시각적으로 구분되는지 (회색 + 작은 크기로 충분)

