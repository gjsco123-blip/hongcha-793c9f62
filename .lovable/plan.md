

# 일괄 PDF 다운로드 기능 추가

## 요약
학교 선택 후 지문 목록 화면(`CategoryFullScreen`)에서 체크박스로 지문을 선택하고, 상단 툴바에서 구문분석/Preview/통합/워크북 PDF를 일괄 다운로드하는 기능.

## 확정된 정책
- **경고 후 차단**: 선택한 지문 중 하나라도 필요 데이터가 없으면, "어떤 지문에 무엇이 없는지" 구체적으로 경고 후 다운로드 중단
- **선택 없으면 버튼 비활성화**
- **PDF 순서**: sort_order 기준
- **통합 PDF 순서**: Preview → 구문분석 (지문별)
- **파일명**: `{학교이름}_구문분석.pdf`, `{학교이름}_Preview.pdf`, `{학교이름}_통합.pdf`, `{학교이름}_워크북.pdf`

## 구현 계획

### 1. `useBatchPdfExport` 훅 생성 (새 파일)
`src/hooks/useBatchPdfExport.ts`

- 기존 `usePdfExport`의 단일 PDF 로직은 건드리지 않음
- `passages` 배열과 `selectedIds`를 받아서:
  - `results_json`에서 `parsePassageStore`로 데이터 추출
  - 데이터 누락 검증 → 누락 시 구체적 에러 메시지 반환
  - 검증 통과 시 순차적으로 PDF blob 생성 → `mergePdfBlobs`로 합침
- 4개 함수 export:
  - `batchExportSyntax(passages, selectedIds, schoolName, teacherLabel)`
  - `batchExportPreview(passages, selectedIds, schoolName)`
  - `batchExportCombined(passages, selectedIds, schoolName, teacherLabel)`
  - `batchExportWorkbook(passages, selectedIds, schoolName)`

### 2. `CategoryFullScreen` UI 수정
`src/components/CategorySelector.tsx`

- 지문 목록 위에 **PDF 툴바** 추가 (학교 선택 후에만 표시)
  - 전체 선택 / 해제 체크박스
  - `N개 선택됨` 텍스트
  - 구문분석 PDF / Preview PDF / 통합 PDF / 워크북 PDF 버튼 4개
  - 선택 없으면 버튼 disabled
- 각 지문 row 왼쪽에 체크박스 추가 (GripVertical 앞)
- 선택 상태: `useState<Set<string>>`

### 3. 데이터 검증 로직
각 PDF 타입별 필요 데이터:
- **구문분석**: `syntaxResults` 존재 + 길이 > 0
- **Preview**: `preview.vocab` 또는 `preview.synonyms` 또는 `preview.summary` 존재
- **통합**: 구문분석 + Preview 둘 다 필요
- **워크북**: `syntaxResults` 존재 (original 필드 사용)

누락 시 경고 예시:
```
다음 지문에 데이터가 없습니다:
- "1과 본문": 구문분석 결과 없음
- "3과 본문": Preview 데이터 없음
해당 지문의 데이터를 먼저 생성해주세요.
```

### 4. props 전달 흐름
`CategoryFullScreen` → `useBatchPdfExport` 훅 사용
- `CategorySelectorProps`에 `schoolName` 추가 (또는 내부에서 `schools`+`selectedSchoolId`로 계산)
- `teacherLabel`은 `useTeacherLabel` 훅으로 가져옴

### 5. 메모리 안전
- PDF를 **순차 생성** (한 번에 하나씩 blob 만들고 merge)
- 지문 10개 이상이면 진행률 표시 (선택사항)

## 기존 기능 영향
- `usePdfExport.ts`: 변경 없음 (기존 단일 export 유지)
- `Index.tsx` / `Preview.tsx`: 변경 없음
- `mergePdfBlobs`를 재사용하므로 `usePdfExport.ts`에서 export 추가 필요
- `CategorySelector.tsx`만 UI 변경

## 파일 변경 목록
| 파일 | 변경 |
|------|------|
| `src/hooks/useBatchPdfExport.ts` | **새 파일** — 일괄 export 로직 |
| `src/hooks/usePdfExport.ts` | `mergePdfBlobs` export 추가 |
| `src/components/CategorySelector.tsx` | 체크박스 + PDF 툴바 UI 추가 |

