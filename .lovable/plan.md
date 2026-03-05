

## 카테고리 관리 기능 (학교 → 지문 계층 구조)

### 개요
학원 강사용 워크시트 관리를 위해 **학교 → 지문** 2단계 카테고리 시스템을 구축합니다. 클라우드 저장 방식이므로 인증(로그인/회원가입) + 데이터베이스 테이블이 필요합니다.

### 1. 데이터베이스 테이블 생성

**schools** 테이블 — 학교 목록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid NOT NULL | auth.users 참조 |
| name | text NOT NULL | 학교 이름 (예: "한영고") |
| created_at | timestamptz | 생성일 |

**passages** 테이블 — 지문 목록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| school_id | uuid NOT NULL | schools 참조 |
| user_id | uuid NOT NULL | auth.users 참조 |
| name | text NOT NULL | 지문 이름 (예: "2학기 중간 L5") |
| passage_text | text | 영어 지문 내용 |
| pdf_title | text | PDF 제목 |
| results_json | jsonb | 분석 결과 (SentenceResult[] 직렬화) |
| preset | text | 고1/고2/수능 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: 각 테이블에 `user_id = auth.uid()` 조건으로 SELECT/INSERT/UPDATE/DELETE 정책 적용.

### 2. 인증 (로그인/회원가입)

- 이메일+비밀번호 기반 로그인/회원가입 페이지 (`/auth`)
- 이메일 확인 필요 (auto-confirm 비활성화)
- 비로그인 시 `/auth`로 리다이렉트
- `AuthProvider` 컨텍스트로 세션 관리

### 3. UI — 헤더 드롭다운

헤더 왼쪽 상단에 2단계 드롭다운 추가:

```text
┌─────────────────────────────────────────────┐
│ [한영고 ▾] > [2학기 중간 L5 ▾]  │  SYNTAX   │
│                                             │
└─────────────────────────────────────────────┘
```

- **학교 드롭다운**: 학교 목록 + "학교 추가" 버튼
- **지문 드롭다운**: 선택된 학교의 지문 목록 + "지문 추가" 버튼
- 지문 선택 시 저장된 passage/results를 불러와 에디터에 로드
- 현재 작업 내용은 선택된 지문에 자동저장 (debounce)

### 4. 새 파일 & 수정 파일

**새 파일:**
- `src/pages/Auth.tsx` — 로그인/회원가입 페이지
- `src/contexts/AuthContext.tsx` — 인증 상태 관리
- `src/components/CategorySelector.tsx` — 학교/지문 드롭다운 컴포넌트
- `src/hooks/useCategories.ts` — 학교/지문 CRUD 훅

**수정 파일:**
- `src/App.tsx` — AuthProvider 래핑, `/auth` 라우트 추가, 보호 라우트 적용
- `src/pages/Index.tsx` — 헤더에 CategorySelector 배치, 지문 선택 시 데이터 로드/저장 로직 추가

### 5. 작업 흐름

1. DB 마이그레이션 (schools, passages 테이블 + RLS)
2. 인증 페이지 & AuthProvider 구현
3. CategorySelector 컴포넌트 + useCategories 훅 구현
4. Index.tsx 헤더에 통합 + 자동저장 로직

