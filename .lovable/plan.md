

# 고정 패턴 강제 적용 안 되는 근본 원인 수정

## 원인 분석

### 원인 1: `byTag` 맵 구축 시 이중 필터링
- `fetchPinnedPatterns()` line 817: `shouldForcePinnedTemplateForSentence()` 체크
- 이 함수는 `keywords.every(kw => sentenceText.includes(kw))` — 패턴의 **모든** 영어 키워드가 문장에 있어야 통과
- 예: 패턴 `과거분사 built가 명사구를 수식` → "built"가 새 문장에 없으면 byTag에 안 들어감
- 결과: 후처리 `applyPinnedPattern`이 빈 맵을 받아서 아무것도 교체 안 함

### 원인 2: 비표준 태그 매칭 실패
- DB에 `강조구문`, `분사`, `전치사+관계대명사`, `현재완료+수동`, `계속적용법 관계대명사`, `대동사` 등 비표준 태그 존재
- `detectUiTagFromContent()`와 `normalizeModelTagToUiTag()`가 이 태그들을 인식 못 함
- → byTag에 `분사` 키로 저장돼도, AI 출력에서 `분사 후치수식`으로 감지되면 매칭 안 됨

## 수정 계획

### 1. `shouldForcePinnedTemplateForSentence` 이중 필터 제거
- `byTag` 맵 구축 시 `patternRelevanceScore`를 이미 통과한 패턴은 무조건 `byTag`에 넣기
- line 817의 `if (!shouldForcePinnedTemplateForSentence(...)) continue;` 제거

### 2. 태그 매칭 확장 — 비표준 태그 인식
- `detectUiTagFromContent()`에 누락된 키워드 추가:
  - `강조` → `강조구문`
  - `분사` (분사구문/후치수식 아닌 일반) → `분사`
  - `전치사+관계대명사` → `전치사+관계대명사`
  - `현재완료+수동`, `현재완료 수동` → `현재완료+수동`
  - `계속적용법`, `계속적 용법` → `계속적용법 관계대명사`
  - `대동사` → `대동사`
- 같은 로직을 `grammar-chat`의 `chatDetectUiTagFromContent`에도 동기화

### 3. `byTag` 조회 시 폴백 매칭 추가
- `applyPinnedPattern`에서 정확히 일치하는 태그가 없으면, 부분 일치(contains) 폴백 시도
- 예: AI 출력이 "분사 후치수식"이면 `분사후치수식` 키를 먼저 찾고, 없으면 `분사`를 포함하는 키도 체크

### 4. `grammar-chat`도 동일하게 후처리 강제
- 현재 `grammar-chat`에서 `chatApplyPinnedPattern`을 `suggestionNotes`에 적용하고 있지만, `pinnedByTag` 구축 시에도 같은 문제(관련성 점수 통과했는데 byTag에 안 넣는 등)가 없는지 확인 → 현재는 `pinnedByTag`에 조건 없이 넣고 있으므로 OK, 하지만 태그 매칭 확장은 필요

## 수정 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/grammar/index.ts` | `shouldForcePinnedTemplateForSentence` 필터 제거, `detectUiTagFromContent` 확장, `applyPinnedPattern` 폴백 매칭 |
| `supabase/functions/grammar-chat/index.ts` | `chatDetectUiTagFromContent` 확장 동기화 |

## 기대 결과
- `patternRelevanceScore`를 통과한 패턴은 반드시 후처리에서 강제 교체됨
- `분사`, `강조구문`, `대동사` 등 비표준 태그도 정상 매칭
- 프롬프트 의존도가 낮아져 고정 패턴 준수율 대폭 향상

