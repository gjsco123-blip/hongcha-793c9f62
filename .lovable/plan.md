

# 동/반의어 개별 삭제 + 행별 AI 추가 버튼

## 현재 구조
동의어/반의어는 쉼표로 구분된 하나의 문자열 (예: `"identify(확인하다), acknowledge(인정하다)"`)로 저장됨. 현재는 input으로 전체 문자열을 편집하는 방식.

## 변경 내용

### 1. 동/반의어를 개별 태그(chip)로 표시
- synonym/antonym 문자열을 쉼표 기준으로 split하여 개별 chip으로 렌더링
- 각 chip에 **× 버튼**을 표시하여 클릭 시 해당 항목만 삭제 (문자열에서 제거 후 재조합)
- chip 스타일: 작은 badge 형태, 호버 시 × 표시

### 2. 행별 AI 추가(+) 버튼
- 각 행 끝에 **+** 버튼 (동/반의어 합산 4개 미만일 때만 표시)
- 클릭 시 `enrich-synonym` Edge Function 호출 → 기존 값에 병합
- 로딩 중 해당 행만 스피너 표시

### 3. 새 Edge Function: `enrich-synonym`
- 입력: `word`, `existingSynonyms`, `existingAntonyms`, `passage`
- AI가 기존 것 제외하고 추가 동/반의어 생성 (한국어 뜻 괄호 포함)
- 출력: `{ synonyms: "추가분", antonyms: "추가분" }`

### 변경 파일
| 파일 | 변경 |
|------|------|
| `supabase/functions/enrich-synonym/index.ts` | 새 Edge Function |
| `src/components/preview/PreviewSynonymsSection.tsx` | chip UI + × 삭제 + AI 추가 버튼 |
| `src/pages/Preview.tsx` | `handleEnrichRow` 핸들러 + props 전달 |

