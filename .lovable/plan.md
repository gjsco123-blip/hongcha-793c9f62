## 작업
`analyze-preview` Edge Function을 Lovable Cloud로 재배포한다.

## 배경
- 코드는 이미 GitHub `main` 및 Lovable 프로젝트에 반영되어 있음 (재생성 다양화 로직: temperature 0.85, previous 회피 신호 주입).
- Codex 환경에는 `SUPABASE_ACCESS_TOKEN`이 없어서 `supabase link`/`supabase functions deploy`가 실패함.
- Lovable Cloud는 자체 권한으로 즉시 배포 가능.

## 실행 단계
1. `supabase--deploy_edge_functions`로 `analyze-preview` 재배포.
2. 배포 후 `supabase--edge_function_logs`로 정상 부팅 확인 (boot 에러 없는지).
3. 사용자에게 재배포 완료 안내 — Preview에서 주제 재생성 클릭 시 다양한 결과가 나오는지 검증 요청.

## 영향 범위
- 코드 변경 없음. 배포만 수행.
- 다른 Edge Function에는 영향 없음.