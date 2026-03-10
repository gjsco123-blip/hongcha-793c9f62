

# 학습 기능 (Few-shot Learning) 구현 계획

## 개요
AI 수정 채팅에서 "적용" 클릭 시 원본→최종 쌍을 DB에 저장하고, 자동생성 시 최근 예시를 프롬프트에 주입하여 사용자 스타일을 반영합니다.

## 1단계: DB 테이블 생성

`learning_examples` 테이블:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| user_id | uuid (NOT NULL) | auth.uid() |
| type | text | 'hongt' 또는 'syntax' |
| preset | text | '수능', '고1', '고2' |
| sentence | text | 원문 영어 문장 |
| ai_draft | text | AI가 처음 생성한 버전 |
| final_version | text | 사용자가 최종 적용한 버전 |
| created_at | timestamptz | now() |

RLS: 본인 데이터만 CRUD 가능 (`user_id = auth.uid()`)

## 2단계: 프론트엔드 — 적용 시 자동 저장

### HongTChat.tsx
- `handleApply` 에서 `onApplySuggestion` 호출 후, `learning_examples` 테이블에 INSERT
  - `type: 'hongt'`, `ai_draft: currentExplanation`, `final_version: suggestion`
- props에 `preset` 추가 필요

### SyntaxChat.tsx
- `handleApply` 에서 동일하게 INSERT
  - `type: 'syntax'`, `ai_draft: currentNotes 텍스트`, `final_version: suggestionNotes 텍스트`
- props에 `preset` 추가 필요

### HongTSection.tsx / SyntaxNotesSection.tsx
- `preset` prop을 Chat 컴포넌트에 전달

### Index.tsx
- `preset` 값을 HongTSection, SyntaxNotesSection에 전달

## 3단계: Edge Functions — few-shot 주입

### hongt/index.ts
- 요청 body에서 `userId` 수신 (프론트에서 auth.uid() 전달)
- Supabase client로 `learning_examples` 에서 `type='hongt'` 최근 3건 조회
- few-shot 예시 형태로 시스템 프롬프트에 추가:
  ```
  [사용자 선호 스타일 예시]
  원문: ... → AI초안: ... → 최종: ...
  ```

### grammar/index.ts (auto 모드)
- 동일하게 `type='syntax'` 최근 3건을 프롬프트에 주입

### hongt-chat/index.ts, grammar-chat/index.ts
- 채팅 수정에서도 스타일 예시를 컨텍스트로 제공

## 4단계: 프론트에서 userId 전달

Edge function 호출 시 `userId: session.user.id` 를 body에 포함하도록 수정:
- `generateHongT` 함수
- `handleGenerateSyntax` 함수  
- `HongTChat`, `SyntaxChat` 의 채팅 호출

## 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| DB migration | `learning_examples` 테이블 + RLS |
| `src/pages/Index.tsx` | preset/userId를 하위 컴포넌트에 전달, 생성 함수에 userId 추가 |
| `src/components/HongTSection.tsx` | preset prop 전달 |
| `src/components/HongTChat.tsx` | 적용 시 DB 저장, preset prop 추가 |
| `src/components/SyntaxNotesSection.tsx` | preset prop 전달 |
| `src/components/SyntaxChat.tsx` | 적용 시 DB 저장, preset prop 추가 |
| `supabase/functions/hongt/index.ts` | userId로 학습 예시 조회 → 프롬프트 주입 |
| `supabase/functions/grammar/index.ts` | 동일 |
| `supabase/functions/hongt-chat/index.ts` | 동일 |
| `supabase/functions/grammar-chat/index.ts` | 동일 |

