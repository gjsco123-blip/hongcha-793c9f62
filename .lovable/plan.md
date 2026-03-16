
문제는 이해했습니다. 그리고 네, 지금 이건 “새 기능을 붙이면 어쩔 수 없이 생기는 오류”라기보다, 위첨자 로직 자체가 지금 너무 약해서 작은 변화에도 다시 틀어지는 상태로 보입니다.

[Do I know what the issue is?]
예. 이번 건은 런타임 에러가 아니라 “위첨자 위치 계산 방식”의 구조적 문제입니다.

## 지금 실제로 깨진 지점
1. `src/lib/syntax-superscript.tsx`
   - 위첨자 위치를 `indexOf(targetText)`로 첫 번째 문자열 일치만 찾아 계산하고 있음
   - 그래서 `it`, `its`, `that`, 반복 단어, 짧은 구문에서 오매칭이 쉽게 남
   - 단어 경계가 아니라 “부분 문자열”로도 잡힐 수 있음

2. `src/components/PdfDocument.tsx`
   - PDF는 또 한 번 chunk/segment 좌표로 재매핑하고 있어서
   - 웹에서 맞아 보여도 PDF에서 왼쪽/오른쪽으로 밀리는 현상이 생김
   - 특히 짧은 단어나 같은 문장 안에 비슷한 형태가 있으면 더 취약함

3. `supabase/functions/grammar/index.ts`
   - `targetText`를 원문 그대로 정확히 주도록 프롬프트는 있지만
   - 실제로는 `its` 대신 `it`, 활용형 대신 원형처럼 애매하게 반환될 가능성이 남아 있음

## 왜 자꾸 재발하냐
- 지금은 “웹 표시”, “PDF 표시”, “AI가 주는 targetText”가 완전히 같은 규칙으로 묶여 있지 않습니다.
- 겉으로는 공통 함수가 있어도 실제 앵커 기준은 아직 불안정합니다.
- 그래서 다른 기능을 건드릴 때 직접 위첨자를 안 만져도, 청킹/구문/패턴/재생성 데이터가 바뀌면 다시 드러날 수 있습니다.

## 수정 계획
1. 위첨자 매칭 로직을 `indexOf` 기반에서 “단어 토큰 단위 매칭”으로 교체
   - 부분 문자열 매칭 금지
   - 원문을 토큰화해서 `targetText`도 같은 방식으로 토큰화 후 연속 단어 시퀀스로 찾기
   - `it`가 `point` 안에 매칭되는 식의 오류 차단

2. 공통 계산 함수가 “정확한 span + 앵커 위치”를 반환하도록 재설계
   - 단순 `start index`만 반환하지 않고
   - 어떤 단어 범위에 해당하는지(span)를 계산
   - 위첨자를 문장 내 어디에 붙일지 기준을 하나로 통일

3. 웹과 PDF가 같은 앵커 데이터를 쓰도록 일원화
   - `src/pages/Index.tsx`의 문장 표시
   - `src/components/PdfDocument.tsx`의 PDF 표시
   - 둘 다 같은 helper 결과만 사용하게 변경

4. PDF 쪽 재매핑 보정
   - 현재의 chunk/segment offset 보정 대신
   - 원문 토큰 index → chunk segment 위치로 직접 매핑하도록 바꿔서
   - “holds / its / breath”처럼 chunk가 끼어도 정확히 같은 위치에 붙게 수정

5. `grammar` 함수 프롬프트 강화
   - `targetText`는 반드시 원문 표면형 그대로 반환
   - `its`를 `it`로 축약 금지
   - 동사 원형/기본형으로 바꾸지 말고 실제 문장에 있는 형태 그대로 반환
   - 짧은 대명사/지시어(`it`, `its`, `that`, `those`) 예시 추가

## 구현 파일
- `src/lib/syntax-superscript.tsx`
- `src/components/PdfDocument.tsx`
- `src/pages/Index.tsx` 또는 해당 렌더 연결부
- `supabase/functions/grammar/index.ts`

## 기대 결과
- 첫 번째 사진(PDF/출력)과 두 번째 사진(웹/미리보기)의 위첨자 위치가 같아짐
- `it/its/that` 같은 짧은 대상도 안정적으로 표시됨
- 같은 단어가 여러 번 나오는 문장에서도 첫 번째 것에 잘못 꽂히는 문제를 줄임
- 이후 다른 기능 추가 시에도 위첨자 위치가 덜 흔들리는 구조로 바뀜

## 기술적으로 핵심 한 줄
“문자열 첫 일치(indexOf)”를 버리고, “원문 토큰 기반 span 매칭 + 공통 anchor 계산”으로 바꾸는 게 이번 문제의 본체입니다.
