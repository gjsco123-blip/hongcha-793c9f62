
## PDF S/V 라벨이 그대로 보이는 원인 분석 및 해결 계획

### 핵심 원인
1. **승인된 PDF 배치 방식이 실제로 구현되지 않음**
   - 현재 `src/components/PdfDocument.tsx`는 라벨을 단어 아래 가운데에 두는 absolute 배치가 아니라,
     `renderInlineSvLabel()`로 **본문 텍스트 뒤에 inline subscript처럼 붙여서** 렌더링하고 있음.
   - 그래서 사용자가 원한
     - 밑줄의 가운데 하단 정렬
     - 밑줄에서 살짝 떨어진 위치
     - 줄간격 100% 유지
     가 구현되지 않았고, 결과적으로 PDF가 거의 안 바뀐 것처럼 보임.

2. **현재 구조상 “밑줄 기준 아래 가운데”가 불가능한 렌더 트리**
   - 지금 PDF 영어 문장은 하나의 큰 `<Text style={styles.englishText}>` 안에서 segment들을 이어붙이는 방식임.
   - react-pdf에서 이 구조는 각 단어별 박스 기준의 absolute label 배치를 하기 어려움.
   - 즉, 단순 스타일 조정만으로는 해결 안 되고 **영문 문장 PDF 렌더 구조 자체를 바꿔야 함**.

3. **다른 PDF 경로는 아예 대상이 아님**
   - `WorkbookPdfDocument.tsx`는 S/V 라벨 로직을 전혀 사용하지 않음.
   - 따라서 사용자가 워크북 PDF를 본 경우엔 당연히 변화가 없음.
   - `syntax PDF`와 `combined PDF`의 syntax 섹션만 이번 변경 대상이 되어야 함.

4. **문서/메모리와 실제 코드가 서로 어긋남**
   - 메모리에는 아직 옛 사양(italic, #666, `v₁'`)이 남아 있고,
   - 실제 코드 일부는 black/11px/6pt로 바뀌었지만 PDF 핵심 배치 방식은 옛 방식 그대로임.
   - 이 불일치 때문에 이후 수정이 계속 빗나갈 가능성이 큼.

### 구현 방향
### 1) PDF 영어 문장 렌더 구조 리팩토링
`PdfDocument.tsx`의 영어 문장 렌더를 “큰 단일 Text 덩어리” 방식에서 아래처럼 바꿈.

```text
Sentence line
└─ inline row-like word wrappers
   ├─ word wrapper (relative)
   │  ├─ underlined word text
   │  └─ sv label (absolute, centered, below underline)
   ├─ plain word
   ├─ slash
   └─ ...
```

핵심:
- 라벨이 필요한 subject/verb segment만 개별 wrapper로 분리
- wrapper `position: relative`
- label `position: absolute`, `top: 100%`, `left: 0`, `right: 0`, `textAlign: center`
- 본문 lineHeight는 기존 `2.5` 그대로 유지
- 라벨은 흐름 밖에 떠 있으므로 줄간격을 밀지 않음

### 2) PDF 스타일을 승인안대로 고정
- base: **6pt**
- subscript: **4.5pt**
- 색상: **#000**
- prime 순서: **`v'₁`**
- underline 아래 간격: 초기값 **1.5pt**
- 가운데 정렬: wrapper 폭 기준 center

### 3) 웹 UI도 동일 표기 규칙으로 정리
`ResultDisplay.tsx`, `ChunkEditor.tsx`
- 표기 순서 `base → prime → subscript`
- 색상 `#000`
- 웹 크기 `11px / 8px`
- 밑줄 아래 `marginTop: 3px`
- 기존 `height: 0; overflow: visible` 패턴 유지

### 4) 라벨 문자열/메모리 정합성 정리
- `sv-labels.ts`는 데이터 구조 유지
- 문자열 fallback / 주석 / memory 문서를 모두 `v'₁` 기준으로 통일
- `.lovable/memory/features/sv-labels.md`를 실제 구현 상태와 일치하게 수정

### 5) 적용 범위 명확화
다음 경로를 모두 점검:
- `syntax PDF 저장`
- `syntax PDF 미리보기`
- `combined PDF`의 syntax 페이지
- `batch syntax export`

다음은 변경 대상 아님을 명시:
- `PreviewPdf`
- `WorkbookPdfDocument` (별도 요청 없으면 그대로 유지)

### 변경 파일
- `src/components/PdfDocument.tsx` — 핵심 구조 리팩토링
- `src/components/ResultDisplay.tsx` — 웹 라벨 표기/스타일 정리
- `src/components/ChunkEditor.tsx` — 웹 라벨 표기/스타일 정리
- `src/lib/sv-labels.ts` — fallback 문자열/주석 정리
- `.lovable/memory/features/sv-labels.md` — 실제 사양 반영

### 검증 항목
1. **syntax PDF가 실제로 달라졌는지**
   - 라벨이 단어 옆이 아니라 밑줄 하단 중앙에 보이는지

2. **줄간격 회귀 없음**
   - 적용 전/후 페이지 수 동일
   - 본문 행간 확대 없음

3. **prime 가독성**
   - `v'₁`, `s'₂`에서 `'`가 숫자에 묻히지 않는지

4. **다음 줄 충돌 여부**
   - 라벨이 아래 줄 텍스트와 겹치지 않는지
   - 필요 시 `marginTop`만 0.5pt 단위 조정

5. **경로별 일관성**
   - 저장/미리보기/통합 PDF에서 동일하게 보이는지
   - workbook PDF는 이번 변경과 무관하다는 점 확인

### 리스크와 대응
- react-pdf inline flow 안에서 absolute wrapper가 예상보다 불안정할 수 있음
- 그래서 구현 시 한 번에 “전체 문장 박스”를 바꾸기보다,
  **라벨이 필요한 segment만 개별 wrapper화**하는 방식으로 최소 리팩토링
- 만약 react-pdf가 해당 구조를 깨면 fallback으로
  - label 전용 zero-height row
  - 단어 폭 추정 기반 centering
  순으로 보수적 대안을 적용

### 기대 결과
이 수정이 끝나면 PDF는 더 이상 “기존과 거의 같은 subscript 느낌”이 아니라,
사용자가 말한 그대로 **주어/동사 밑줄의 중간 하단에 검은색 `s / v / s' / v'₁` 라벨이 살짝 떨어져 보이는 형태**로 바뀜.
