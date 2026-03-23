

# 고정 패턴 태그 매칭 누락 — 근본 원인 및 수정 계획

## 원인

DB에 저장된 고정 패턴 태그와, 코드에서 인식하는 태그 목록이 **심각하게 불일치**합니다.

### DB에 있는 태그 (실제 저장된 것)
`4형식`, `5형식`, `as 형부 as`, `so~that`, `to be pp`, `too~to`, `가목적어/진목적어`, `가주어/진주어`, `강조구문`, `계속적 용법 관계부사`, `계속적용법 관계대명사`, `관계대명사`, `관계부사`, `기타`, `대동사`, **`동격접`**, `동명사주어`, `명사절`, `병렬구조`, `분사`, `분사 후치수식`, `분사구문`, `비교구문`, `수동태`, `수일치`, `전치사+관계대명사`, `현재완료+수동`

### `GRAMMAR_TAGS` 셋에 없는 태그 (= Track 1에서 무조건 탈락)
- `동격접` ← **이게 핵심 누락**
- `동명사주어`
- `4형식`
- `as 형부 as`, `so~that`, `to be pp`, `too~to`
- `계속적 용법 관계부사` (공백 차이로 `계속적용법 관계대명사`와 불일치)

### `detectUiTagFromContent`에서도 감지 못하는 것
- `동격` 키워드 자체가 아예 없음 → AI가 "동격의 접속사 that"이라고 출력해도 `기타`로 분류
- `동명사주어`, `4형식`, `as~as`, `so~that`, `too~to` 등도 감지 안 됨

### 결과
1. Grammar Track에서 `동격접` 태그가 `GRAMMAR_TAGS`에 없으므로 → Phrase Track으로 빠짐
2. Phrase Track에서 영어 키워드 매칭 시도 → "동격의 접속사 that이 이끄는..." 패턴에서 키워드가 `that`, `belief` 등인데, 현재 문장에 `that`은 있어도 `belief`는 없으면 탈락
3. 설령 프롬프트에 들어가더라도, 후처리 `applyPinnedPattern`에서 `detectUiTagFromContent`가 `동격`을 못 잡으니 `기타`로 분류되어 `byTag`에서 `동격접` 키와 매칭 안 됨
4. 결론: **동격접 패턴은 프롬프트 주입도 안 되고, 후처리 강제도 안 됨**

## 수정 계획

### 1. `GRAMMAR_TAGS` 셋에 DB의 모든 태그 추가
누락된 태그 전부 등록:
- `동격접`, `동명사주어`, `4형식`
- `as 형부 as`, `so~that`, `to be pp`, `too~to`
- `계속적 용법 관계부사`

### 2. `detectUiTagFromContent`에 누락된 키워드 추가
- `동격` → `동격접`
- `동명사` + `주어` → `동명사주어`
- `4형식` → `4형식`
- `so` + `that` → `so~that`
- `too` + `to` → `too~to`
- `as` + `as` → `as 형부 as`
- `to be pp` / `to be p.p` → `to be pp`

### 3. `normalizeModelTagToUiTag`에도 동일 매핑 추가
AI가 `tag` 필드에서 반환할 수 있는 변형까지 커버

### 4. `grammar-chat/index.ts`의 `chatDetectUiTagFromContent`에도 동기화

## 수정 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/grammar/index.ts` | `GRAMMAR_TAGS` 확장, `detectUiTagFromContent` 확장, `normalizeModelTagToUiTag` 확장 |
| `supabase/functions/grammar-chat/index.ts` | 동일 태그 감지 로직 동기화 |

## 기대 결과
- `동격접` 패턴이 Grammar Track으로 프롬프트에 주입됨
- AI 출력에 "동격"이 포함되면 후처리에서 `동격접` 키로 `byTag` 매칭 → 고정 패턴 강제
- 나머지 누락 태그(`동명사주어`, `4형식`, `so~that` 등)도 동일하게 복원
