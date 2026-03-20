

# 계정별 선생님 이름 커스터마이징

## 개요
"홍T"를 계정별로 다른 이름(예: "미현T")으로 표시할 수 있도록 설정 기능 추가.

## 변경 사항

### 1. DB 테이블 생성
`user_preferences` 테이블 — `user_id`(PK), `teacher_label`(기본값 '홍T'). RLS로 본인 데이터만 접근.

### 2. 커스텀 훅 생성
`src/hooks/useTeacherLabel.ts` — DB에서 label 조회, 없으면 '홍T'로 upsert, 변경 함수 제공.

### 3. 설정 UI
헤더 영역(CategoryHeaderBar 옆 또는 아래)에 작은 설정 아이콘 추가. 클릭하면 팝오버로 선생님 이름 입력 필드 표시.

### 4. 컴포넌트 수정 (prop 전달)
| 파일 | 변경 |
|------|------|
| `Index.tsx` | `useTeacherLabel()` 호출, HongTSection에 `teacherLabel` prop 전달 |
| `HongTSection.tsx` | `teacherLabel` prop 받아서 하드코딩된 "홍T" 대체 |
| `HongTChat.tsx` | `teacherLabel` prop 받아서 "홍T 대화 수정" → `${teacherLabel} 대화 수정` 등 |
| `PdfDocument.tsx` | `teacherLabel` prop 추가, PDF 라벨 동적 표시 |
| `usePdfExport.ts` | `teacherLabel` 파라미터 추가하여 PdfDocument에 전달 |

### 5. 변경하지 않는 것
- Edge Function 프롬프트 (AI 내부용, 출력에 "홍T" 텍스트 없음)
- 기존 테이블 구조
- 분석/생성 로직

### 리스크
- 모든 변경은 표시 문자열만 교체 (기본값 '홍T'로 폴백)
- 기존 기능에 영향 없음

