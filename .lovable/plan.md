# Option C: Topic 자동 재시도 (백엔드 내부)

## 목표
첫 생성(`mode="all"`) 결과의 `exam_block.topic`이 문장형(예: "Strategies must be evaluated...")으로 나올 경우, 백엔드 내부에서 `mode="topic"` 전용 프롬프트로 주제만 재생성하여 덮어쓴다. 사용자가 "재생성" 버튼을 누른 것과 동일한 품질을 첫 생성에서 보장한다.

## 변경 파일
`supabase/functions/analyze-preview/index.ts` 단 한 곳.

## 구현 단계

### 1. 문장형 판별 함수 추가
파일 상단 헬퍼 영역(`safeParseJson` 근처)에 `isSentenceLikeTopic(topic: string): boolean` 추가.

판별 기준 (하나라도 해당하면 문장형으로 간주):
- 마침표(.)로 끝남
- 조동사 포함: `must / should / can / could / may / might / will / would`
- be동사/연결동사 포함: `\b(is|are|was|were|be|been|being)\b`
- 평가/기능 동사 포함: `\b(serves?|fails?|requires?|provides?|enables?|reflects?|demonstrates?|shows?|proves?|leads?)\b`
- 종속 접속사 포함: `\b(because|although|while|since|whereas)\b`
- 단어 수 12개 초과

### 2. 내부 재시도 로직 추가
`mode === "all"` 분기 (Self-Critique 직후, line 668 이후)에 추가:

```text
parsed = safeParseJson(content) 직후
↓
if (mode === "all" && parsed?.exam_block?.topic && isSentenceLikeTopic(parsed.exam_block.topic)) {
  console.log("[analyze-preview] topic looks sentence-like, retrying with topic-only mode");
  topic 전용 systemPrompt 재구성 (buildSystemPrompt("topic", grade))
  callAi 한 번 더 호출
  결과 파싱 → exam_block.topic / topic_ko 만 덮어쓰기
  실패 시 원본 유지
}
```

### 3. 로깅
어떤 케이스가 트리거됐는지 추적할 수 있도록:
- `[analyze-preview] topic retry triggered: "<원본 topic>"`
- `[analyze-preview] topic retry succeeded: "<새 topic>"`
- 실패 시 `[analyze-preview] topic retry failed, keeping original`

## 영향 범위
- 프론트엔드 변경 없음
- 다른 mode(`topic`/`title`/`exam_summary`/`passage_summary`)에는 영향 없음
- Self-Critique 로직 그대로 유지 (그 뒤에 한 번 더 안전망으로 작동)
- 첫 생성 시 호출이 1회 추가될 수 있음 (문장형으로 판정될 때만, 약 30~50% 케이스 예상)

## 추가 안전장치
재시도 결과가 또 문장형이면 그대로 반환(무한 루프 방지). 1회 재시도까지만.

## 검증 방법
배포 후 실제 지문으로 첫 생성 → 로그에서 `topic retry triggered/succeeded` 확인 → 결과 topic이 명사구 형태인지 확인.
