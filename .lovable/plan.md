

# 지문 추가 영역 하단 여백 추가

## 변경 내용
`src/components/CategorySelector.tsx` 553번 줄의 닫는 `</div>` 바로 위, 즉 `addingPassage` 블록과 버튼을 감싸는 영역에 `pb-12` 클래스를 추가.

구체적으로 547번 줄 버튼의 부모인 552번 줄 `)}` 이후 553번 줄 `</div>`가 전체 passage 섹션을 닫는 div인데, 이 div에 `pb-12`를 추가하면 됨.

**수정 위치**: 486번 줄 `addingPassage` 입력 영역과 545번 줄 버튼을 감싸는 부모 컨테이너에 하단 패딩 적용 (1줄 변경).

