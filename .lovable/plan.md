

## 동사구 밑줄 연속성 개선 (flag 없이 바로 적용)

### 변경 파일
- `src/lib/chunk-utils.ts` — `mergeAdverbsBetweenVerbs(segments)` 함수 추가
- `src/components/PdfDocument.tsx` — 렌더 직전 변환 적용
- `src/components/ResultDisplay.tsx` — 렌더 직전 변환 적용
- `src/components/WorkbookPdfDocument.tsx` — 동일 적용 (있을 경우 동사 렌더 부분만)

### 핵심 로직
동사 segment → [비-동사 segment] → 동사 segment 패턴에서, 사이 segment를 동사로 흡수:

**병합 조건 (모두 충족 시)**
- 사이 텍스트에 콤마/마침표/세미콜론 없음
- 공백을 제외한 단어 수가 0~2개
- 단어가 다음 중 하나:
  - 공백만 (예: `can` `get`)
  - `-ly`로 끝남 (예: `carefully`, `quickly`)
  - 빈출 부사 화이트리스트: `always, never, often, sometimes, just, only, also, still, even, already, ever, well, not, no, hardly, barely, rarely, almost, nearly, quite, very`

**병합 방식**
- 세 segment를 하나의 `{ text: "합쳐진 텍스트", isVerb: true }`로 결합
- 데이터 원본(저장된 `<v>` 태그)는 변경 없음 — 렌더 시 시각 표현만 개선

### 검증 케이스
1. `can always be injected` → 한 줄 밑줄 ✓
2. `can get` (사이 공백만) → 한 줄 밑줄 ✓
3. `have carefully evaluated` → 한 줄 밑줄 ✓
4. `is, however, important` → 병합 안 됨 (콤마 보호)
5. `can quickly and easily get` → 병합 안 됨 (3단어 초과)
6. 단일 동사, 비-동사구간 → 영향 없음

### 안전장치
- 데이터 변경 0 → 기존 저장 데이터 모두 즉시 적용
- 보수적 화이트리스트 → 오버 매칭 방지
- 문제 시 함수 한 줄 비활성화로 즉시 롤백 가능

### 검증
- Index 페이지 / PDF / Preview에서 동사구 표시 확인
- 위 6개 케이스 직접 확인

