

## 분석 결과

### 버그 원인

`paginateResults`의 `passageReserve` 로직에 **자기모순(self-defeating)** 버그가 있습니다.

현재 코드 (line 386-393):
```text
remainingHeight = 남은 모든 문장 높이 합산
needsPassageSpace = (remainingHeight + 70) <= 현재 페이지 남은 공간?
  → true이면 passageReserve = 70 (passage 공간 확보)
```

**문제 시나리오** (문장 5개, 문장 4 검사 시):
1. 문장 1~3이 배치된 후, 남은 공간 = 약 160pt
2. 문장 4+5+passage(70) = 약 150pt → 다 들어감 → `needsPassageSpace = true`
3. `passageReserve = 70` 적용 → 실질 가용 공간 = 160 - 70 = 90pt
4. 문장 4의 높이(~100pt) > 90pt → **오버플로우 → 다음 페이지로 밀림**
5. 하지만 passage를 예약하지 않았으면 160pt > 100pt → **충분히 들어감**

즉, "모든 문장이 이 페이지에 들어갈 수 있다"는 판단이 passage 예약을 유발하고, 그 예약이 오히려 문장을 밀어내는 **자기모순** 구조입니다.

### 해결 방법

`passageReserve`를 **마지막 문장(`isLastResult`)일 때만** 적용하고, 중간 문장에서의 lookahead 예약(`needsPassageSpace`)을 제거합니다. passage 섹션은 마지막 문장이 배치될 때 자연스럽게 고려됩니다.

### 변경 사항

**`src/components/PdfDocument.tsx`** — `paginateResults` 함수 (line 386-393)

변경 전:
```typescript
let remainingHeight = hLast;
for (let j = i + 1; j < results.length; j++) {
  remainingHeight += estimateSentenceHeight(results[j], j === results.length - 1);
}
const needsPassageSpace = remainingHeight + PASSAGE_H <= pageCapacity - usedHeight;
const passageReserve = isLastResult || needsPassageSpace ? PASSAGE_H : 0;
```

변경 후:
```typescript
const passageReserve = isLastResult ? PASSAGE_H : 0;
```

**`src/pages/Index.tsx`** — 동일한 웹 미리보기 페이지네이션 로직에도 같은 패턴 적용 (lookahead 제거).

### 변경 파일
- `src/components/PdfDocument.tsx` — passageReserve lookahead 제거 (6줄 → 1줄)
- `src/pages/Index.tsx` — 웹 미리보기 동기화

