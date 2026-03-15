

## 구문분석 패턴 고정(Pin) 기능

### 완료된 변경

1. **DB: `syntax_patterns` 테이블** — user_id, tag, pinned_content, example_sentence + RLS
2. **`supabase/functions/grammar/index.ts`** — `fetchPinnedPatterns()` 추가, 자동생성/힌트 모드 모두 시스템 프롬프트에 `[고정 패턴]` 블록 주입
3. **`supabase/functions/grammar-chat/index.ts`** — 동일하게 고정 패턴 주입
4. **`src/components/SyntaxNotesSection.tsx`** — 각 노트에 📌 호버 버튼 (자동 태그 감지 + 선택), 고정 패턴 관리 버튼
5. **`src/components/PinnedPatternsManager.tsx`** (신규) — Sheet 형태 관리 UI (목록/삭제/직접 추가)
