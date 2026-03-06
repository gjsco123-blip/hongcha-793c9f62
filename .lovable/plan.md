

## 문제 원인

Preview에서 뒤로가기 시 Index 페이지가 리마운트됨. `selectedPassageId`는 sessionStorage에서 즉시 복원되지만, `passages` 배열은 DB에서 비동기로 불러오므로 처음에는 빈 배열임.

Index.tsx의 `useEffect`(113번 줄)가 `selectedPassageId`로 트리거되지만, 이 시점에 `selectedPassage`가 `null`이라 아무 상태도 설정하지 않음. 이후 passages가 로드되어도 `selectedPassageId`가 변하지 않았으므로 effect가 다시 실행되지 않음 → 빈 화면.

## 해결 방법

**`src/pages/Index.tsx`** — useEffect 의존성에 `categories.selectedPassage`를 추가

```typescript
// 기존 (line 131)
}, [categories.selectedPassageId]);

// 변경
}, [categories.selectedPassageId, categories.selectedPassage]);
```

이렇게 하면 passages가 비동기 로드 완료되어 `selectedPassage`가 `null` → 실제 객체로 바뀔 때 effect가 다시 실행되어 passage_text, results_json 등이 정상 복원됨.

