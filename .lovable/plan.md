

## 지문 제목 → PDF 헤더 자동 동기화

### 현재 상태
- `src/pages/Index.tsx`의 `pdfTitle` 상태가 현재 PDF 헤더 제목을 관리
- 초기값: "SYNTAX" (기본값)
- 지문 선택 시: `categories.selectedPassage.pdf_title` 값으로 로드됨
- `setPdfTitle()` 호출로 수동 변경 가능

### 문제점
사용자가 새 지문을 추가할 때 입력하는 지문 **이름**이 자동으로 `pdfTitle`에 반영되지 않음. 현재는 `pdf_title` 필드를 별도로 관리하고 있음.

### 해결책
2가지 방식 가능:

**방식 A (추천)**: 지문 이름 → pdf_title 자동 연동
- 지문 생성 시: `pdf_title = passage.name` 자동 설정
- 에디터 로드 시: `passage.name` → `pdfTitle` 자동 로드
- 사용자가 PDF 제목을 별도로 수정할 수 있도록 허용 (입력 필드 제공)

**방식 B**: 지문 이름과 PDF 제목 완전히 분리
- 현재 방식 유지, 사용자가 명시적으로 PDF 제목 입력

### 구현 방안 (방식 A 선택)

**1. `src/hooks/useCategories.ts`에서:**
- `addPassage` 호출 시 `pdf_title: name`을 기본값으로 설정
- DB에 저장할 때 pdf_title도 함께 저장

**2. `src/pages/Index.tsx`에서:**
- 지문 로드 시 `passage.pdf_title` 또는 `passage.name` 사용 (우선순위: pdf_title > name)
- PDF 제목 입력 필드는 유지 (수동 변경 가능)

**3. UI 추가:**
- 헤더에 "PDF 제목" 입력 필드 추가 (현재 `pdfTitle` 설정)
- 기본값: 현재 지문 이름

### 작업 항목
- `useCategories.ts`: `addPassage()` 수정
- `Index.tsx`: 지문 로드 로직 개선

