import { useState, useRef, useCallback } from "react";
import { Merge, Scissors } from "lucide-react";

interface SentencePreviewProps {
  sentences: string[];
  onChange: (sentences: string[]) => void;
}

export function SentencePreview({ sentences, onChange }: SentencePreviewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [splitCursor, setSplitCursor] = useState<{ index: number; pos: number } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleMerge = useCallback(
    (index: number) => {
      if (index >= sentences.length - 1) return;
      const next = [...sentences];
      next[index] = `${next[index]} ${next[index + 1]}`;
      next.splice(index + 1, 1);
      onChange(next);
    },
    [sentences, onChange]
  );

  const handleDoubleClick = (index: number) => {
    setEditingIndex(index);
    setEditValue(sentences[index]);
    setSplitCursor(null);
  };

  const handleSave = () => {
    if (editingIndex === null) return;
    const parts = editValue
      .split(" / ")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      // 빈 문장이면 삭제
      const next = sentences.filter((_, i) => i !== editingIndex);
      onChange(next);
    } else if (parts.length === 1) {
      const next = [...sentences];
      next[editingIndex] = parts[0];
      onChange(next);
    } else {
      // " / "로 분할
      const next = [...sentences];
      next.splice(editingIndex, 1, ...parts);
      onChange(next);
    }
    setEditingIndex(null);
  };

  const handleSplit = (index: number) => {
    // 현재 선택 위치에서 문장 분할
    if (!textRef.current) return;
    const pos = textRef.current.selectionStart;
    const text = editValue;
    if (pos <= 0 || pos >= text.length) return;

    const left = text.slice(0, pos).trim();
    const right = text.slice(pos).trim();
    if (!left || !right) return;

    const next = [...sentences];
    next.splice(index, 1, left, right);
    onChange(next);
    setEditingIndex(null);
  };

  if (sentences.length === 0) return null;

  return (
    <div className="border border-border bg-card">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          문장 미리보기
        </span>
        <span className="text-[10px] text-muted-foreground">
          더블클릭 편집 · " / " 입력으로 분할 · 합치기로 병합
        </span>
      </div>
      <div className="divide-y divide-border">
        {sentences.map((sentence, i) => (
          <div key={i}>
            <div className="flex items-start gap-2 px-3 py-2 group">
              <span className="text-[10px] font-semibold text-muted-foreground shrink-0 w-5 pt-0.5 text-right">
                {String(i + 1).padStart(2, "0")}
              </span>

              {editingIndex === i ? (
                <div className="flex-1 flex flex-col gap-1.5">
                  <textarea
                    ref={textRef}
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSave();
                      }
                      if (e.key === "Escape") setEditingIndex(null);
                    }}
                    rows={2}
                    className="w-full bg-background border border-foreground px-2 py-1.5 text-xs font-english text-foreground outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSplit(i)}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      title="커서 위치에서 나누기"
                    >
                      <Scissors className="w-3 h-3" />
                      커서에서 나누기
                    </button>
                    <button
                      onClick={handleSave}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      저장 (Enter)
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      취소 (Esc)
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  onDoubleClick={() => handleDoubleClick(i)}
                  className="flex-1 text-xs font-english leading-relaxed text-foreground cursor-pointer hover:bg-muted/50 px-1 py-0.5 -mx-1 transition-colors"
                  title="더블클릭으로 편집"
                >
                  {sentence}
                </p>
              )}
            </div>

            {i < sentences.length - 1 && (
              <div className="flex justify-center -my-px">
                <button
                  onClick={() => handleMerge(i)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-40 hover:opacity-100"
                  title="아래 문장과 합치기"
                >
                  <Merge className="w-3 h-3" />
                  합치기
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
