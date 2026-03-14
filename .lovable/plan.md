

# 구문분석 패턴 고정(Pin) 기능

## 이해한 내용

현재 `learning_examples`는 AI초안 vs 최종본 비교로 "스타일"을 학습하지만, **특정 문법 패턴에 대한 설명 방식을 명시적으로 고정**하는 기능은 없습니다. 예를 들어 "분사구문은 항상 '접속사+주어 생략, ~ing로 시작하는 분사구문'이라고 써라" 같은 룰을 저장하고, 이후 자동 생성이나 AI 채팅에서 항상 이 패턴을 따르게 하는 것.

## 설계

### 1. 새 테이블: `syntax_patterns`

```sql
CREATE TABLE public.syntax_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL,           -- 문법 카테고리 (예: '분사구문', '관계대명사', '수동태')
  example_sentence text,       -- 원문 예시 (선택)
  pinned_content text NOT NULL, -- 고정할 설명 패턴
  created_at timestamptz DEFAULT now()
);
```

### 2. UI: SyntaxChat에서 "패턴 고정" 버튼

구문분석 채팅에서 수정안을 **적용**한 뒤, 해당 포인트 옆에 📌 버튼이 나타남. 클릭하면:
- 문법 카테고리를 자동 감지 (TAG_RULES 기반) 또는 사용자가 선택
- 해당 설명 방식이 `syntax_patterns`에 저장됨

또한 구문분석 노트 목록에서도 각 포인트를 길게 누르거나 핀 아이콘을 클릭해서 고정 가능.

### 3. AI 프롬프트에 고정 패턴 주입

`grammar/index.ts`와 `grammar-chat/index.ts`에서 기존 `fetchLearningBlock` 처럼 `syntax_patterns`를 조회하여 시스템 프롬프트에 추가:

```
[고정 패턴 — 아래 문법 항목은 반드시 해당 형식으로 작성하라]
분사구문: 접속사+주어 생략, ~ing로 시작하는 분사구문
관계대명사: 주격 관계대명사 who/which/that이 선행사 ___를 수식하는 관계절을 이끔
```

이렇게 하면 자동 생성, 드래그 수동 생성, AI 채팅 수정 모두에서 고정된 패턴을 따르게 됩니다.

### 4. 관리 UI (선택)

설정 페이지나 모달에서 고정된 패턴 목록을 확인/수정/삭제할 수 있는 간단한 관리 화면.

## 수정 파일

1. **DB 마이그레이션** — `syntax_patterns` 테이블 생성 + RLS
2. **`src/components/SyntaxNotesSection.tsx`** — 각 노트에 📌 고정 버튼 추가
3. **`src/components/SyntaxChat.tsx`** — 적용 시 "이 패턴 고정?" 옵션
4. **`supabase/functions/grammar/index.ts`** — `fetchPinnedPatterns()` 추가, 프롬프트에 주입
5. **`supabase/functions/grammar-chat/index.ts`** — 동일하게 고정 패턴 주입
6. **`src/components/PinnedPatternsManager.tsx`** (신규) — 고정 패턴 목록 관리 UI

