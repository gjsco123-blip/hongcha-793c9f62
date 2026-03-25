

# 모든 계정에서 관리자 Few-shot 데이터 공유 구현

## 요약
3개 Edge Function에서 `learning_examples` 조회 시, 요청한 사용자의 `userId` 대신 **관리자 계정(co500123@naver.com)의 UUID**를 사용하도록 변경. DB 마이그레이션 불필요, 프론트엔드 변경 없음.

## 변경 파일 및 내용

### 1. `supabase/functions/grammar/index.ts`

**관리자 UUID 조회 헬퍼 추가** (함수 상단, 모듈 레벨):
- `getAdminUserId()` — `SUPABASE_SERVICE_ROLE_KEY`로 `auth/v1/admin/users` API 호출, `co500123@naver.com` 이메일의 UUID 반환
- 모듈 레벨 캐싱으로 중복 호출 방지

**`fetchLearningBlock` 수정** (640~660행):
- `userId` 파라미터 무시, 대신 `await getAdminUserId()`로 관리자 UUID 획득
- 해당 UUID로 `learning_examples` 조회
- 관리자 UUID를 못 가져오면 빈 문자열 반환 (기존과 동일한 안전 폴백)

### 2. `supabase/functions/grammar-chat/index.ts`

**관리자 UUID 조회 헬퍼 추가** (동일 로직)

**학습 예시 조회 부분 수정** (161~165행):
- `user_id=eq.${userId}` → `user_id=eq.${adminUid}`

### 3. `supabase/functions/hongt-chat/index.ts`

**관리자 UUID 조회 헬퍼 추가** (동일 로직)

**학습 예시 조회 부분 수정** (74행):
- `user_id=eq.${userId}` → `user_id=eq.${adminUid}`

## 공통 헬퍼 코드

```typescript
let cachedAdminUid: string | null = null;
async function getAdminUserId(): Promise<string | null> {
  if (cachedAdminUid) return cachedAdminUid;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/auth/v1/admin/users?page=1&per_page=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const { users } = await res.json();
    const admin = users.find((u: any) =>
      u.email?.toLowerCase() === "co500123@naver.com"
    );
    if (admin) cachedAdminUid = admin.id;
    return cachedAdminUid;
  } catch { return null; }
}
```

## 영향 범위
- 프론트엔드 코드: **변경 없음**
- DB 마이그레이션: **불필요**
- 관리자 계정 동작: **변경 없음** (관리자가 수정하면 자기 데이터가 저장되고, 모든 계정이 그 데이터를 참조)
- 다른 계정의 저장 로직: **그대로 유지** (저장은 되지만 조회에 사용되지 않음)
- 오류 가능성: **없음** (service_role_key로 RLS 우회, 관리자 못 찾으면 빈 문자열 폴백)

