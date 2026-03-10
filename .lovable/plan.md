

# 구문분석 3가지 수정

## 변경 사항 (`supabase/functions/grammar/index.ts` 1개 파일)

### 1. freestyle(드래그) 모드 — 선택 구문에만 집중 + 1개 제한
- `maxPts`: line 525 `useFreestyle ? 5 : 1` → 무조건 `1`
- freestyle용 시스템 프롬프트를 `buildAutoSystemPrompt()` 대신 `buildHintSystemPrompt()` 기반으로 변경하되, 태그 제한 없이 "선택된 구문과 직접 관련된 문법/용법 포인트 1개만 작성하라"로 지시
- freestyle 유저 메시지도 "선택 구문에 해당하는 포인트 1개만" 으로 변경

### 2. 자동생성 — 숙어/구동사/용법 설명 폴백
- `buildAutoSystemPrompt()`의 `[우선 추출 대상]`에 **숙어/구동사(phrasal verb)/주요 용법(count as, serve as 등)** 추가
- 빈 결과 방지: "구조적 문법 포인트가 없으면 해당 문장의 핵심 숙어/구동사/표현의 용법을 설명하라" 지시 추가

### 3. 자동생성 — 조동사+수동태 자동 추출 강화
- `[우선 추출 대상]`에 이미 "조동사+수동"이 있지만, 문체 예시에 구체적 예시 보강: `can/may/must/will + be p.p. 형태의 조동사 수동태 구조`
- 추출 우선순위 설명에 "조동사+be p.p. 구조가 있으면 반드시 포함할 것" 명시

변경 파일: 1개 (`grammar/index.ts`)

