

# 그래머 챗 4방향 종합 개선

## 문제 원인

### 1. 수정안이 안 바뀌는 근본 원인
프론트엔드 `SyntaxChat.tsx` line 80:
```
messages: newMessages.map((m) => ({ role: m.role, content: m.content }))
```
assistant 메시지의 `content`에는 AI의 전체 답변이 들어있고, 그 안에 `[수정안]...[/수정안]` 블록이 포함됨. 사용자가 "틀렸어"라고 해도, 히스토리에 이전 수정안 텍스트가 그대로 남아서 모델이 자기 이전 출력을 복사함.

현재 서버 측 `allowReanalysis` 로직이 마지막 assistant 메시지 하나만 마스킹하지만, `[수정안]` 블록 자체가 히스토리에 그대로 들어가는 게 문제.

### 2. 모델 속도
`google/gemini-3.1-pro-preview` 사용 중 → 느림. `google/gemini-3-flash-preview`로 변경.

### 3. 고정패턴 후처리 실패
`___` 없는 패턴에서 English swap이 불안정. 영어 세그먼트 개수가 안 맞으면 AI 원문 그대로 반환.

### 4. 질문 답변 약함
시스템 프롬프트가 "구문분석 수정" 역할에 집중 → 문법 질문에 대한 심층 분석 지시 부족.

## 수정 계획

### 파일 1: `supabase/functions/grammar-chat/index.ts`

**A. 모델 변경** (line 517)
- `google/gemini-3.1-pro-preview` → `google/gemini-3-flash-preview`

**B. 히스토리에서 수정안 블록 제거** (line 497-503 부근)
- `filteredMessages`를 구성할 때, 모든 assistant 메시지에서 `[수정안]...[/수정안]` 블록을 strip
- 이렇게 하면 모델이 자기 이전 수정안 텍스트를 볼 수 없어 앵커링 차단
- `allowReanalysis` 시에는 추가로 마지막 assistant 메시지 전체를 마스킹 (기존 로직 유지)

**C. 고정패턴 후처리 강화** (`chatMaterializePinnedPattern`)
- `___` 없는 패턴: English swap 실패 시 AI 원문 대신 **템플릿 자체를 반환**하되, AI 출력에서 영어 구문 1개를 추출해 템플릿의 첫 번째 영어 부분만 교체
- 즉 "한국어 구조는 반드시 템플릿 따르기" 원칙 강제

**D. 시스템 프롬프트 보강**
- "■ 문법 질문 응답" 섹션 추가: "사용자가 문법 판별 질문을 하면, 해당 문장의 구체적 근거(어떤 단어가 어떤 역할)를 들어 판단 이유를 명확히 설명하라. 단순히 '맞습니다/아닙니다'로 끝내지 말고, 왜 그런지 문장 내 근거를 제시하라."
- 수정안 규칙에 추가: "이전 대화에서 제공한 수정안과 동일한 내용을 반복하지 말 것. 사용자가 수정을 요청하면 반드시 이전과 다른 새로운 수정안을 제시하라."

### 파일 2: `src/components/SyntaxChat.tsx`

**E. 히스토리 전송 시 수정안 블록 strip** (line 80)
- 프론트엔드에서도 보험: assistant 메시지의 content에서 `[수정안]...[/수정안]` 부분을 제거한 뒤 서버로 전송
- 이중 방어 (프론트 + 서버 양쪽에서 strip)

## 수정 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/grammar-chat/index.ts` | 모델 변경, 히스토리 수정안 strip, 패턴 후처리 강화, 프롬프트 보강 |
| `src/components/SyntaxChat.tsx` | 히스토리 전송 시 수정안 블록 제거 |

## 기대 결과
- 응답 속도: Pro → Flash로 2~3배 빨라짐
- 수정안 반복: 히스토리에서 이전 수정안이 제거되므로 모델이 새로운 수정안 생성
- 고정패턴: 템플릿 구조가 더 강하게 강제됨
- 질문 답변: 문법 근거를 구체적으로 제시하도록 프롬프트 보강

