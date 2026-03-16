

# 로그인 버튼 미니멀화 + 빌드 에러 수정

## 변경 사항

### 1. `src/pages/Auth.tsx` — 로그인 버튼 축소
- `h-11` 고정 높이 제거 → `py-2`로 변경
- `text-xs` → `text-[11px]`
- `uppercase tracking-widest` → `tracking-wider` (대문자 제거, 자간 축소)
- 전체적으로 더 가볍고 앱 나머지 버튼과 통일된 느낌

### 2. `src/pages/Preview.tsx` (338행) — 빌드 에러 수정
- `results_json: mergedStore` → `results_json: mergedStore as any`
- `PassageStorePayload`의 `unknown[]`이 Supabase `Json` 타입과 호환되지 않는 문제 해결

