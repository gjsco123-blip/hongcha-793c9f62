

## 명사절 주어 — 정확한 규칙 정리

### 이해 수정
이전 플랜은 "명사절이 주어 자리면 `<s>` 자체를 생략" → **이건 잘못 이해한 것.**

올바른 이해:
- **명사절 전체를 `<s>`로 묶지 마라** (밑줄 겹침 발생)
- 대신 **명사절 안의 진짜 주어(내부 주어)를 `<s>`로 처리하라**

### 적용 규칙

| 케이스 | 처리 |
|---|---|
| `What he said is true` | `What`은 `<s>` 안 함, **내부 주어 `he`만 `<s>`** / `said`, `is` 모두 `<v>` |
| `That he lied surprised me` | `That` 절 전체 안 묶음, **`he`만 `<s>`** / `lied`, `surprised` 모두 `<v>` |
| `Whether it rains matters` | **`it`만 `<s>`** / `rains`, `matters` 모두 `<v>` |
| `What I want is rest` | **`I`만 `<s>`** / `want`, `is` 모두 `<v>` |

핵심:
- 주절(상위 절)에는 명사절이 주어지만 → **상위 절의 `<s>`는 비움** (명사절 전체 묶기 금지)
- 명사절(하위 절) 내부에는 → **내부 주어를 `<s>`로 정상 처리**
- 결과: `<s>`와 `<v>`가 절대 겹치지 않음, 학습자는 내부 절 구조를 명확히 인식

### 회귀 안전성
- 가주어 It (`It is important that he came`) → **`It`만 `<s>`**, 명사절 안 `he`도 `<s>` (변동 없음, 둘 다 정상 작동)
- 동명사구 주어 (`Locking-in prices ...`) → 그대로 `<s>` (명사절 아님)
- to부정사구 주어 (`To learn English ...`) → 그대로 `<s>` (명사절 아님)
- 일반 NP 주어 → 그대로 `<s>` (변동 없음)

### 엔진 프롬프트 변경 (engine/index.ts)

**1차 분석 규칙에 명시:**
- "명사절(that-clause, wh-clause, whether-clause)이 주어 자리에 있을 때, 명사절 전체를 `<s>`로 감싸지 말 것"
- "대신 그 명사절 내부의 finite verb의 주어만 `<s>`로 태깅할 것"
- "결과적으로 상위 절은 `<s>` 없이 `<v>`만 가지게 될 수 있음 — 정상"

**Few-shot 예시 추가:**
- `<c1>What <s>he</s> <v>said</v></c1> <c2><v>is</v> true</c2>` ✓
- `<c1>That <s>he</s> <v>lied</v></c1> <c2><v>surprised</v> me</c2>` ✓
- ❌ 금지: `<s>What he said</s>` (명사절 통째 태깅 금지)

**Subject verification pass에 동기화:**
- 명사절 전체를 감싼 `<s>` 발견 시 → 제거하고 내부 주어로 옮김
- 상위 절에 `<s>`가 없어도 정상으로 인정 (강제 추가 금지)

### 변경 파일
- `supabase/functions/engine/index.ts` (1차 프롬프트 + verification pass)
- `mem://features/subject-underline.md` (명사절 주어 규칙 명문화)

### 기존 데이터
엔진 수정 후 현재 지문은 **재분석 필요**.

