

## 우클릭 컨텍스트 메뉴 — 주절/종속절 자동 판별

### 동작
편집 모드에서 단어 **우클릭** → 작은 메뉴 팝업:
```
주어 표시
동사 표시
표시 해제
```

선택 시 해당 단어의 역할이 즉시 적용됨. 더블클릭(기존 동사 토글)은 그대로 유지 → 학습된 사용자 워크플로우 보존.

### 종속절 자동 판별 (핵심)
선택한 단어가 **종속절 안에 있는지**를 같은 문장의 기존 라벨 분포로 추정:

1. 같은 문장(`SentencePreview` 단위)의 모든 chunk 순회
2. 클릭한 단어 위치 주변에서 **가장 가까운 종속절 시작 마커** 탐색:
   - 종속 접속사/관계사 (that, which, who, whom, whose, when, where, why, how, if, whether, because, although, though, while, since, unless, until, after, before, as, what)
   - 또는 인접 segment 중 `isSubordinate: true`가 있으면 그 범위 내로 간주
3. 클릭 단어가 그 마커 이후 & 종속절 종료 전이면 → `isSubordinate: true`로 라벨 부여 (s' / v')
4. 아니면 주절 → `isSubordinate: false` (s / v)

판별이 모호하면 기본은 **주절(s/v)**, 사용자가 원치 않으면 한 번 더 우클릭으로 재선택 가능 (실용적 fallback).

### 변경 파일

**`src/components/ChunkEditor.tsx`**
- `onContextMenu` 핸들러 추가 (단어 span)
- 우클릭 시 위치 기반 popover 메뉴 렌더 (selection tooltip과 같은 패턴)
- 메뉴 항목: 주어 / 동사 / 해제 (3개)
- 적용 함수 `applyRole(role: 's' | 'v' | 'none')`:
  - `detectSubordinate(chunkIndex, wordIndex, allChunks)` 호출
  - segments 업데이트 시 `isSubordinate`도 함께 설정
  - `groupId: undefined` (단독 라벨)

**`src/lib/sv-labels.ts`** 또는 새 파일 `src/lib/subordinate-detect.ts`
- `detectSubordinate(chunks, ci, wi): boolean` 유틸 추가
- 종속 접속사/관계사 사전 + 인접 segment의 `isSubordinate` 검사

### 더블클릭은?
기존 그대로 유지: **동사 토글만** (없음 ↔ 동사). 주어 표시는 우클릭 메뉴 전용 → 실수 방지.

### sv_labels / subject_underline 플래그 OFF
- 메뉴는 항상 표시 (단순 토글이라 비용 없음)
- 라벨 표시 자체는 플래그 따라 가려지지만 데이터는 저장됨
- 플래그 ON 시 자동으로 보임

### 검증 포인트
1. 단어 우클릭 → 메뉴 표시, 브라우저 기본 메뉴 차단
2. "주어" 선택 → s 라벨 + 밑줄
3. "동사" 선택 → v 라벨 + 밑줄
4. "해제" → 표시 제거
5. 종속 접속사(that/which/who 등) 뒤 단어를 v로 지정 → 자동 v' 표시
6. 주절 단어를 v로 지정 → 그냥 v 표시
7. 더블클릭은 기존 동사 토글로 동작 유지
8. PDF에 s/v, s'/v' 정확히 출력
9. 자동 판별이 틀린 경우(드물게) — 한 번 더 우클릭으로 다시 지정 가능

### 한계 (솔직)
- 종속절 판별은 휴리스틱(키워드 기반)이라 100%는 아님
- 복잡한 중첩 종속절(종속절 안의 종속절)은 모두 s'/v'로 통일 (s''/v''는 미지원)
- 정확도가 부족하면 후속으로 Shift+우클릭=강제 종속절 옵션 추가 가능

