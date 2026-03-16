

## 구문분석 패턴 고정(Pin) 기능

### 완료된 변경

1. **DB: `syntax_patterns` 테이블** — user_id, tag, pinned_content, example_sentence + RLS
2. **`supabase/functions/grammar/index.ts`** — `fetchPinnedPatterns()` 추가, 자동생성/힌트 모드 모두 시스템 프롬프트에 `[고정 패턴]` 블록 주입
3. **`supabase/functions/grammar-chat/index.ts`** — 동일하게 고정 패턴 주입
4. **`src/components/SyntaxNotesSection.tsx`** — 각 노트에 📌 호버 버튼 (자동 태그 감지 + 선택), 고정 패턴 관리 버튼
5. **`src/components/PinnedPatternsManager.tsx`** (신규) — Sheet 형태 관리 UI (목록/삭제/직접 추가)

## 위첨자(Superscript) 안정화 리팩터링

### 완료된 변경

1. **`src/lib/syntax-superscript.tsx`** — `indexOf` 기반 부분문자열 매칭을 **단어 토큰 시퀀스 매칭(`findTargetSpan`)**으로 완전 교체. "it"이 "point" 안에서 매칭되는 등의 오류 차단.
2. **`src/components/PdfDocument.tsx`** — 공통 `computeSuperscriptPositions`가 토큰 매칭을 사용하므로 PDF도 자동으로 동일 로직 적용.
3. **`supabase/functions/grammar/index.ts`** — targetText 규칙 강화:
   - 표면형 그대로 반환 의무화 (its→it 축약 금지)
   - 짧은 단어 단독 사용 금지 (최소 2단어 + 주변 문맥 포함)
   - 구체적 ✅/❌ 예시 추가
