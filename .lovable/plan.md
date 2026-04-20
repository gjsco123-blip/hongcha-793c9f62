

## 검토 결과

### 이 방식이 적절한 이유
- **업계 표준**: Feature flag는 GitHub, Netflix, Facebook 등 대부분 회사가 쓰는 방식 (LaunchDarkly, Unleash 같은 전문 도구도 같은 원리)
- **너의 상황에 맞음**: 3명 소규모 팀 + 운영 중 + 단계적 검증 원함 → 정확히 이 패턴이 풀려는 문제
- **이미 프로젝트에 비슷한 패턴 존재**: `syntax_patterns` 테이블의 관리자 RLS, 메모리에도 "관리자 글로벌 공유" 패턴이 있어 일관성 OK

### 추가로 다듬을 부분 (이전 플랜 보강)

1. **DB 동기화 속도 문제**
   - React Query 캐싱 30초 → 토글 ON 후 최대 30초 기다려야 반영됨
   - 개선: 캐싱은 5분으로 길게 + `/admin`에서 토글 시 `queryClient.invalidateQueries` 즉시 무효화 + Supabase Realtime으로 flag 변경 자동 감지 (선택)
   - 단순화 안: 캐싱 60초 + 페이지 새로고침 시 즉시 반영 (실용적)

2. **관리자 진입점 위치**
   - 헤더가 페이지마다 다르면 일관성 깨짐
   - Index 페이지 우측 상단 로그아웃 버튼 옆에 톱니바퀴 추가 (가장 자연스러움)

3. **flag 미존재 처리**
   - `useFeatureFlag('없는키')` → false 반환 + 콘솔 경고 (개발 중 오타 방지)

4. **첫 시드는 빈 테이블로**
   - `sv_labels` 시드는 Phase 2에서 그 기능 만들 때 추가
   - Phase 1은 인프라만, flag는 0개로 시작 → 더 깔끔

---

## 최종 Phase 1 플랜 (보강판)

### DB
- 신규 테이블 `feature_flags`
  - `key` text unique, `enabled_for_admin` bool default false, `enabled_for_all` bool default false, `description` text, `created_at`, `updated_at`
- RLS: SELECT 모든 인증 사용자 / INSERT·UPDATE·DELETE는 관리자 이메일만 (`syntax_patterns` 패턴 그대로)
- updated_at 자동 갱신 트리거

### 신규 파일
- `src/lib/admin.ts` — `isAdmin(user)` (이메일 기반)
- `src/hooks/useFeatureFlag.ts` — flag 조회 + 캐싱(60초) + 안전한 fallback
- `src/pages/AdminSettings.tsx` — `/admin` 페이지, 비관리자 리다이렉트, flag 카드 목록 + 토글 UI

### 수정 파일
- `src/App.tsx` — `/admin` 라우트 추가
- `src/pages/Index.tsx` — 관리자에게만 보이는 톱니바퀴 진입점

### 안전장치
- 기존 페이지 동작 변경 0
- 다른 2명: 톱니바퀴 안 보임, `/admin` 직접 입력해도 리다이렉트
- flag 조회 실패/미존재 → false (절대 깨지지 않음)

---

## 사용 방법 상세 설명

### 일상 흐름

**Step 1. 새 기능 만들고 싶을 때**
- 나(Lovable)랑 대화: "S/V 라벨 기능 추가해줘"
- 나는 자동으로 코드를 `useFeatureFlag('sv_labels')`로 감싸서 만듦
- 동시에 `feature_flags` 테이블에 `sv_labels` 행을 자동 추가 (둘 다 false)

**Step 2. 관리자 모드로 켜기**
- 본인 계정(`co500123@naver.com`)으로 로그인 (이미 돼 있을 가능성 높음)
- 우측 상단 **톱니바퀴 클릭** → `/admin` 진입
- `sv_labels` 카드에서 **"관리자에게 보이기"** 토글 ON
- 페이지 새로고침 (또는 60초 대기) → 본인 계정에만 새 기능 보임

**Step 3. 검증하기**
- 오른쪽 Lovable 프리뷰에서 직접 사용해봄
- 문제 발견 → 나랑 대화하며 수정
- 다른 2명은 이 시간 동안 평소처럼 기존 기능만 사용 (영향 0)

**Step 4. 전체 공개**
- 충분히 검증됐다 싶으면 `/admin`에서 **"모두에게 공개"** 토글 ON
- 이제 3명 모두 새 기능 사용 가능

**Step 5. 문제 생기면 즉시 롤백**
- `/admin` → 토글 OFF
- 즉시 모든 사용자에게 숨김 (코드 수정/배포 불필요)

### 유의사항 4가지

**A. 본인 계정 로그인 상태 확인**
- 오른쪽 프리뷰에서 새 기능 보려면 반드시 `co500123@naver.com`으로 로그인된 상태여야 함
- 다른 계정으로 돼 있으면 새 기능 안 보임 → 당황하지 말고 로그인 계정 확인

**B. 페이지 새로고침 타이밍**
- 토글 변경 후 즉시 반영 안 되면 **페이지 새로고침** 한 번
- 60초 캐싱 때문 (실시간 반영 아님)

**C. 새 기능마다 flag 1개**
- S/V 라벨 → `sv_labels`
- 다음에 다른 기능 → `feature_xyz`
- 기능별로 독립적으로 켜고 끄기 가능

**D. flag는 "임시 도구"**
- 기능이 완전히 안정화되고 1~2주 후, "모두에게 공개" 상태 유지하면서 flag 코드 정리해서 일반 코드로 흡수해도 됨
- 안 정리해도 큰 문제 없지만, 너무 많이 쌓이면 유지보수 부담

### 실제 대화 예시

```
[너] S/V 라벨 기능 추가해줘
[나] feature_flags에 sv_labels 추가하고, S/V 라벨 코드를 그 flag로 감싸서 구현했어. 
     /admin에서 "관리자에게 보이기" 켜고 확인해줘.

[너] 라벨 위치가 너무 아래로 내려가
[나] (수정)... 다시 확인해줘.

[너] 좋아 완벽해. 이제 다른 사람들도 쓸 수 있게 해줘
[너] (직접 /admin에서 "모두에게 공개" 토글 ON)
```

### 리스크 / 한계
- DB 호출 1회 추가 (로그인 시 + 60초마다) — 성능 영향 거의 없음
- 새 기능 코드는 항상 빌드에 포함됨 — 번들 크기 약간 증가 (무시 가능 수준)
- flag 토글은 너만 가능 — 다른 2명은 베타 참여 불가 (필요하면 화이트리스트로 확장 가능, 지금은 불필요)

