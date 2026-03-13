

# 힌트 모드에도 학습 패턴 반영

## 현재 상태
- **자동 생성 모드** (`isAutoMode`): `learning_examples` 5개 fetch → 프롬프트에 주입 ✅
- **힌트 모드** (freestyle/tag 모두): `learning_examples` fetch 없음 ❌

## 수정

### 파일: `supabase/functions/grammar/index.ts`

힌트 모드 경로 (line 490 이후)에서도 `userId`가 있으면 `learning_examples`를 fetch하여 시스템 프롬프트에 추가합니다.

구체적으로:
1. line 500 (`LOVABLE_API_KEY` 체크) 앞에 자동 모드와 동일한 `learning_examples` fetch 블록 추가
2. fetch한 예시를 `learningBlock` 문자열로 구성
3. line 530의 `systemPrompt`에 `+ learningBlock` 추가

자동 모드와 동일한 패턴이므로, 코드를 공통 함수로 추출하여 중복 제거합니다.

```text
변경 전 (힌트 모드):
  systemPrompt만 사용

변경 후:
  learningBlock = fetchLearningExamples(userId)  // 공통 함수
  systemPrompt + learningBlock
```

### 변경량
- `grammar/index.ts` 1개 파일, ~20줄 추가/수정

