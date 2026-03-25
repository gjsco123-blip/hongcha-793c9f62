

# grammar 함수 고정패턴 로직 수정

## 문제 원인
`applyPinnedPattern` 함수(line 382)가 AI의 문장별 분석 결과를 **고정패턴 원문으로 통째로 교체**하고 있음. 프롬프트도 "패턴을 그대로 사용하라"고 지시하여 AI가 해당 문장에 맞는 분석 대신 템플릿을 복사함.

## 변경 사항

### 1. `applyPinnedPattern` 후처리 제거
- line 382의 `return normalizedPinned;` → AI 원본 결과를 그대로 유지
- 함수가 패턴 매칭 여부만 확인하되, **AI 결과를 덮어쓰지 않도록** 변경

### 2. 프롬프트 수정 (line 624-630)
- "패턴의 문장을 그대로 사용하라" → **"패턴의 말투·형식·종결어미 스타일을 따르되, 현재 문장의 실제 영어 구문과 문법 설명으로 작성하라"**
- ___만 교체하라는 지시 제거
- 패턴은 "스타일 참고 예시"로 역할 전환

### 3. 자동 모드 / 힌트 모드 모두 적용
- 자동 모드(line 789): `applyPinnedPattern` 호출 수정
- 힌트 모드(line 940): `applyPinnedPattern` 호출 수정

## 수정 파일
- `supabase/functions/grammar/index.ts` (1개 파일)

## 모델 변경
없음 — `gemini-3-flash-preview` 유지

