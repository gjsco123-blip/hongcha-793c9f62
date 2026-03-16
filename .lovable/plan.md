

# 고정 패턴: 핀 UI에서 직접 추가 + 관리에서 수정 기능

## 변경 사항

### 1. SyntaxNotesSection.tsx — 핀 드롭다운에 "고정 패턴으로 추가" 기능
첫 번째 스크린샷: 태그 선택 드롭다운 + 확인 버튼 옆에 현재는 기존 노트 내용을 그대로 고정하는 것만 가능. 이미 구현되어 있음 — 별도 추가 불필요.

→ 재확인: 스크린샷 1은 이미 작동 중인 핀 UI(태그 select + 확인 + X)를 보여주고 있음. 혹시 "이 드롭다운에서 새 패턴을 직접 입력해서 추가"하는 기능을 원하는 건지 확인 필요... 하지만 문맥상 "여기에서 고정패턴을 추가하는 기능"은 이미 있는 핀 버튼의 기능 자체를 말하는 것이 아니라, **내용을 수정해서** 고정할 수 있게 해달라는 의미로 보임. 현재는 노트 내용을 그대로만 고정 가능하고, 내용을 편집해서 고정하는 옵션이 없음.

### 1. SyntaxNotesSection.tsx — 핀 시 내용 편집 가능하게
- 핀 드롭다운(태그 선택 UI)에 `pinned_content`를 편집할 수 있는 텍스트 입력 추가
- 기존 노트 내용이 기본값으로 채워지고, 수정 후 "확인" 클릭 시 수정된 내용으로 저장

### 2. PinnedPatternsManager.tsx — 기존 패턴 수정(편집) 기능
- 각 패턴 카드에 수정(편집) 버튼 추가
- 클릭 시 해당 패턴의 tag와 pinned_content를 인라인 편집 가능
- 저장 시 `supabase.update()` 호출

### 변경 파일
- `src/components/SyntaxNotesSection.tsx` — 핀 UI에 content 편집 textarea 추가
- `src/components/PinnedPatternsManager.tsx` — 각 패턴에 편집 모드 토글 + update 로직

