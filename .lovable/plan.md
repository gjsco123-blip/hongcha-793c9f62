

# 버튼 미니멀화 — 아이콘 제거 + 크기 축소 + 완료 토글

## 변경 요약

모든 액션 버튼에서 아이콘을 제거하고 크기를 줄입니다. "완료 표시"는 작은 토글 스위치로 변경합니다.

## 변경 파일

### 1. `src/pages/Index.tsx` (639~695행)
- **PDF 미리보기 / PDF 저장 / Preview 버튼**: 아이콘 제거, `px-4 py-2` → `px-3 py-1`, `gap-1.5` 제거
- **실패 재시도 버튼**: 아이콘 제거, 동일하게 축소
- **분석하기 버튼**: `px-5 py-2` → `px-4 py-1.5`
- **완료 표시**: 버튼 → 작은 토글 스위치 (`Switch` 컴포넌트 + "완료" 라벨, `text-[10px]`)
- 사용하지 않는 아이콘 import 제거 (`Eye`, `FileDown`, `Loader2`, `RefreshCw`)

### 2. `src/pages/Preview.tsx` (364~382행)
- 헤더의 **PDF 미리보기 / PDF 저장** 버튼: 아이콘 제거, `px-3 py-1`로 축소
- **완료 표시**: 동일하게 토글 스위치로 변경
- 타이틀 옆 `Eye` 아이콘 제거
- 사용하지 않는 아이콘 import 제거

### 3. `src/components/preview/SectionHeader.tsx`
- 재생성 버튼의 `RefreshCw` 아이콘 제거, 텍스트만 유지
- 로딩 스피너(`Loader2`)는 텍스트 "..." 으로 대체

### 4. `src/components/preview/PreviewPassageInput.tsx`
- Generate 버튼 크기 축소 (확인 후 아이콘 있으면 제거)

## 토글 스위치 상세
기존 shadcn `Switch` 컴포넌트를 활용:
```
<div className="flex items-center gap-1.5">
  <span className="text-[10px] text-muted-foreground">완료</span>
  <Switch checked={completed} onCheckedChange={toggle} className="scale-75" />
</div>
```

