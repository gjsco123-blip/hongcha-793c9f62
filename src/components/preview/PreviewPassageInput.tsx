import { useState } from "react";

interface Props {
  passage: string;
  setPassage: (v: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  vocabReady: boolean;
  onWordClick: (word: string) => void;
  addingWord: string | null;
}

export function PreviewPassageInput({ passage, setPassage, isGenerating, onGenerate, vocabReady, onWordClick, addingWord }: Props) {
  const [mode, setMode] = useState<"edit" | "select">("edit");

  // Extract words from passage for clickable mode
  const words = passage.split(/(\s+)/);

  return (
    <div>
      {vocabReady && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setMode(mode === "edit" ? "select" : "edit")}
            className={`text-[10px] px-2.5 py-1 border transition-colors ${
              mode === "select"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode === "select" ? "✓ 단어 선택 모드" : "📝 편집 모드"}
          </button>
          {mode === "select" && (
            <span className="text-[10px] text-muted-foreground">원문에서 단어를 클릭하면 어휘에 추가됩니다</span>
          )}
        </div>
      )}

      {mode === "edit" || !vocabReady ? (
        <textarea
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="영어 지문 전체를 붙여넣으세요."
          rows={6}
          className="w-full bg-card border border-border px-4 py-3 text-sm font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
        />
      ) : (
        <div className="w-full bg-card border border-border px-4 py-3 text-sm font-english leading-relaxed text-foreground min-h-[150px] select-none">
          {words.map((segment, i) => {
            if (/^\s+$/.test(segment)) return <span key={i}>{segment}</span>;
            const cleanWord = segment.replace(/[^a-zA-Z'-]/g, "");
            if (!cleanWord) return <span key={i}>{segment}</span>;
            const isAdding = addingWord === cleanWord.toLowerCase();
            return (
              <span
                key={i}
                onClick={() => onWordClick(cleanWord)}
                className={`cursor-pointer rounded px-0.5 transition-colors ${
                  isAdding
                    ? "bg-primary/20 text-primary"
                    : "hover:bg-muted hover:text-foreground"
                }`}
              >
                {segment}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex justify-end mt-3">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !passage.trim()}
          className="px-6 py-2 bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isGenerating ? "생성 중..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
