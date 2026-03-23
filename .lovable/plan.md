

# 자동저장이 사라지는 원인 분석 및 수정 계획

## 발견된 버그 2개

### 버그 1: Index 페이지가 Preview 저장 데이터를 덮어씀 (핵심 원인)

1. Preview에서 어휘/요약 등을 수정 → DB에 `results_json.preview`로 저장됨
2. 뒤로가기로 Index(구문분석)로 돌아옴
3. Index 페이지의 `persistIndexState`가 `categories.selectedPassage?.results_json`을 base로 사용
4. 하지만 이 `selectedPassage`는 **처음 로드한 시점의 데이터**이고, Preview에서 저장한 최신 데이터가 반영되지 않음
5. Index 자동저장이 실행되면 → `mergePassageStore(옛날 데이터, ...)` → **Preview에서 수정한 내용이 사라짐**

### 버그 2: Index 페이지에서 passage/pdfTitle 편집 시 자동저장 안 됨

- `autoSave` 콜백의 의존성이 `[selectedPassageId, results, persistIndexState]`뿐
- `passage`나 `pdfTitle`을 직접 편집해도 `autoSave`가 재실행되지 않음
- 편집 후 다른 지문 선택하거나 새로고침하면 수정 사항 유실

## 수정 계획

### 1. Index의 mergePassageStore base를 최신 DB 데이터로 교체
- `persistIndexState` 실행 시 **먼저 DB에서 현재 `results_json`을 읽은 후** 그걸 base로 merge
- 또는 `baseResultsJson` ref를 Index에도 도입하여, Preview에서 돌아올 때 DB에서 fresh load

### 2. Index 자동저장 의존성에 `passage`, `pdfTitle` 추가
- `autoSave`의 deps에 `passage`, `pdfTitle`도 포함
- 또는 auto-save useEffect의 의존성에 직접 추가

### 3. Preview → Index 복귀 시 passages 데이터 갱신
- `useCategories`의 `fetchPassages`를 Index 복귀 시 다시 호출하거나
- `selectedPassage`의 `results_json`을 DB에서 재로드

## 수정 파일

1. **`src/pages/Index.tsx`** — persistIndexState에서 fresh base 사용 + autoSave deps 보강
2. **`src/hooks/useCategories.ts`** — 필요시 passage 단건 reload 함수 추가

## 기대 효과
- Preview에서 수정한 어휘/요약이 Index 자동저장에 의해 덮어써지지 않음
- passage/pdfTitle 직접 편집도 자동저장됨
