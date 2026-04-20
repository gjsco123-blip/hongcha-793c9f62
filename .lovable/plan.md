

## UI–PDF 라벨 동기화 — `mergeAdverbsBetweenVerbs` 적용

### 원인 (정확히)
PDF는 `mergeAdverbsBetweenVerbs`로 `[동사][부사][동사]` 패턴을 시각적으로 한 동사 그룹으로 합쳐서 라벨링함:
- `are even happily endorsed` → 한 덩어리 → `v₃` 하나
- `go unquestioned` 같이 단일 동사 → `v₂` 그대로

반면 UI(`ChunkEditor.tsx`)는 원본 segments 그대로 단어 매핑함:
- `are`(verb) / `even`(non-verb) / `happily`(non-verb) / `endorsed`(verb) → `v₃`, `v₄` 두 개로 보임

→ **데이터는 동일, 렌더 경로만 불일치**.

### 해결
`ChunkEditor.tsx`의 `wordLabelLookup` 계산 부분을 PDF와 동일하게 `mergeAdverbsBetweenVerbs` 결과 기준으로 다시 매핑.

### 변경 파일
**`src/components/ChunkEditor.tsx`**

1. `mergeAdverbsBetweenVerbs` import 추가.
2. `computeSvLabels`는 **원본 chunks 기준 그대로** 호출(데이터 충실 유지) — 단, 라벨을 단어에 꽂을 때 병합 후 segment 기준으로 매핑.
3. `wordLabelLookup` 빌드 로직 교체:
   ```
   for each chunk ci:
     { segments: merged, indexMap } = mergeAdverbsBetweenVerbs(chunk.segments)
     mergedSv = Map<mergedSi, SvLabel>()
     for oi in chunk.segments:
       lbl = svMap.get(`${ci}:${oi}`)
       if lbl && !mergedSv.has(indexMap[oi]):
         mergedSv.set(indexMap[oi], lbl)
     // merged segments → words → 라벨 위치 결정 (verb=마지막 단어, subject=첫 단어)
     for merged segments: place label on target word index
   ```
4. 단어 자체 렌더(`words` 배열, 밑줄 처리)는 **원본 segments 기준 그대로** 유지 → 동사 토글/우클릭/분할 동작에 영향 없음. 밑줄도 verb segment 단어마다 그대로 그어지므로 `are even happily endorsed` 전체가 자연스럽게 밑줄 연속처럼 보임(이미 그렇게 동작 중).

### 영향 범위
- ✅ `are even happily endorsed` → `v₃` 하나로 표시
- ✅ `can always be injected`, `is being studied` 같은 동사구도 단일 라벨
- ✅ 기존 단일 동사(`go`, `endorsed` 분리되지 않은 경우) 동작 그대로
- ✅ 편집 모드의 클릭/더블클릭/우클릭 좌표 매핑 영향 없음 (원본 words 기준 유지)
- ✅ PDF는 변경 없음 (이미 정상)

### 변경 안 하는 것
- `sv-labels.ts`, `chunk-utils.ts`, `PdfDocument.tsx`
- ChunkEditor의 단어 분할/병합/우클릭 로직
- 데이터 저장 구조

### 검증 포인트
1. `are even happily endorsed`가 UI에서 `v₃` 하나로 보이는지 (PDF와 일치)
2. 단일 동사들은 기존 라벨 유지
3. 병렬 동사 그룹(`v₁/v₂`)이 그대로 매겨지는지
4. 편집 모드 진입 후 단어 클릭/더블클릭/우클릭 정상 동작
5. 종속절 `v'` 라벨도 동일하게 한 덩어리로 표시되는지
6. 밑줄이 동사구 전체에 연속으로 보이는지

