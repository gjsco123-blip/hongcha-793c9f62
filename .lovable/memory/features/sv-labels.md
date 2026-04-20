---
name: SV Labels
description: 동사·주어 밑줄 아래에 s/v 라벨 표시 — 주절(s,v) vs 종속절(s',v'), 병렬 그룹은 v₁/v₂ subscript
type: feature
---

# S/V 라벨 시스템

## 표기 규칙
| 케이스 | 라벨 |
|---|---|
| 주절 단독 주어/동사 | `s` / `v` |
| 주절 병렬 주어/동사 | `s₁`,`s₂` / `v₁`,`v₂` (subscript 숫자) |
| 종속절(부사절·관계절·명사절) 단독 | `s'` / `v'` |
| 종속절 병렬 | `s₁'`,`s₂'` / `v₁'`,`v₂'` |

병렬 = 같은 절 안에서 등위접속(and/or/but/콤마)된 동일 역할 군집. 다른 절끼리는 병렬 아님.

## 데이터 모델 (chunk-utils.ts)
`ChunkSegment`에 두 필드 추가:
- `isSubordinate?: boolean` — vs/ss 태그면 true
- `groupId?: number` — 같은 절 안 병렬 그룹 ID

## 엔진 태그 스키마 (engine/index.ts)
- `<s>` / `<v>` — 주절(matrix)
- `<ss>` / `<vs>` — 종속절
- 병렬: `g="N"` 속성으로 묶음 (같은 N = 병렬). 단독은 g 없음.
- 단일 주어 NP("John and Mary")는 단일 `<s>` — 병렬 아님.
- 보조동사 체인(have been working)은 단일 `<v>` — 병렬 아님.

## 라벨 계산 (sv-labels.ts)
`computeSvLabels(chunks)` → `Map<"ci:si", SvLabel>` 반환.
- (role, isSubordinate, groupId) 버킷팅
- 멤버 ≥2 → 번호 부여, 단독 → 번호 없음

## 렌더링
- **순서**: `base → prime(') → subscript`. 예: 주절 단독 `v`, 주절 병렬 `v₁`, 종속절 단독 `v'`, 종속절 병렬 `v'₁`. prime을 subscript 앞에 두어 작은 숫자에 묻히지 않음.
- **웹 (ResultDisplay/ChunkEditor)**: `inline-flex flex-col`로 단어 아래에 라벨. 컨테이너 `height:0; overflow:visible`로 줄높이 영향 0. 폰트 11px (subscript 8px), `text-black`, `marginTop: 3px` (밑줄에서 살짝 분리).
- **PDF (PdfDocument)**: 영문 문장을 단일 `<Text>` 대신 `<View flexDirection="row" flexWrap="wrap">` 컨테이너(`englishRow`)로 렌더. 라벨이 붙는 verb/subject 세그먼트는 `<View style={labeledWrap}>` (position:relative, flexDirection:row)로 감싸고, 그 안에 밑줄 텍스트 + absolute 라벨(`top:"100%", left:0, right:0, textAlign:"center", marginTop:1.5pt`)을 둠. fontSize 6pt (subscript nested 4.5pt), color `#000`. lineHeight 2.5 그대로 → 줄간격 변동 0. italic 미사용(폰트 등록 회피).

## Feature Flag
`sv_labels` (feature_flags 테이블, 관리자 기본 ON, 일반 사용자 OFF). `subject_underline`과 독립.

## 회귀
- 기존 데이터는 자동으로 모두 주절 처리됨 (`<s>`/`<v>`만 → isSubordinate=false, groupId=undefined)
- 종속절·병렬 라벨을 보려면 **재분석 필요**
