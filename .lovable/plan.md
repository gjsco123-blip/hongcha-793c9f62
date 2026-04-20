

## 동사구 사이 시간·빈도 부사 추가 병합

### 문제
`are now confronted`에서 `now`가 화이트리스트에 없어 밑줄이 끊김. 비슷하게 `then, soon, recently, finally` 등 시간 부사들도 동일 이슈 가능.

### 변경
- `src/lib/chunk-utils.ts`의 `VERB_PHRASE_ADVERB_WHITELIST`에 다음 추가:
  - **시간**: `now, then, soon, recently, finally, eventually, currently, suddenly, immediately`
  - **빈도/정도 보강**: `usually, normally, generally, simply, truly, really, completely, fully, totally, mostly, mainly, largely`
  - **태도/방식**: `clearly, easily, quickly, slowly, carefully` (대부분 `-ly` 규칙으로 이미 잡히지만 명시화)

### 안전장치 유지
- 콤마/마침표 포함 시 병합 안 함 (`is, however, important` 보호)
- 2단어 초과 시 병합 안 함
- 데이터 변경 0, 렌더 시각만 개선

### 검증 케이스
1. `are now confronted` → 한 줄 밑줄 ✓
2. `has recently been studied` → 한 줄 밑줄 ✓
3. `is, however, important` → 분리 유지 ✓
4. `can quickly and easily get` → 분리 유지 (3단어) ✓

