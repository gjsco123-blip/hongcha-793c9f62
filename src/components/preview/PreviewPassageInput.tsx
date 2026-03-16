import { useState, useRef, useEffect } from "react";

type SelectTarget = "vocab" | "synonym";

interface Props {
  passage: string;
  setPassage: (v: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  vocabReady: boolean;
  onWordClick: (word: string) => void;
  addingWord: string | null;
  synonymSelectMode?: boolean;
  onSynonymWordClick?: (word: string) => void;
  addingSynonymWord?: string | null;
}

export function PreviewPassageInput({
  passage, setPassage, isGenerating, onGenerate, vocabReady,
  onWordClick, addingWord,
  synonymSelectMode, onSynonymWordClick, addingSynonymWord,
}: Props) {
  const [mode, setMode] = useState<"edit" | "select">("edit");
  const [selectTarget, setSelectTarget] = useState<SelectTarget>("vocab");
  const containerRef = useRef<HTMLDivElement>(null);

  // When synonymSelectMode is activated externally, switch to select mode
  useEffect(() => {
    if (synonymSelectMode) {
      setMode("select");
      setSelectTarget("synonym");
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [synonymSelectMode]);

  const words = passage.split(/(\s+)/);

  const activeSelectTarget = synonymSelectMode ? "synonym" : selectTarget;

  const handleWordClickInternal = (word: string) => {
    if (activeSelectTarget === "synonym" && onSynonymWordClick) {
      onSynonymWordClick(word);
    } else {
      onWordClick(word);
    }
  };

  const activeAddingWord = activeSelectTarget === "synonym" ? addingSynonymWord : addingWord;

  return (
    <div ref={containerRef}>
      {vocabReady && (
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => {
              if (mode === "edit") {
                setMode("select");
                setSelectTarget("vocab");
              } else {
                setMode("edit");
              }
            }}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              mode === "select"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode === "select" ? "단어 선택 모드" : "편집 모드"}
          </button>
          {mode === "select" && (
            <>
              {!synonymSelectMode && (
                <div className="flex gap-1">
                  {(["vocab", "synonym"] as SelectTarget[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectTarget(t)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        activeSelectTarget === t
                          ? "border-foreground/50 bg-foreground/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t === "vocab" ? "어휘" : "동반의어"}
                    </button>
                  ))}
                </div>
              )}
              <span className="text-[10px] text-muted-foreground">
                {activeSelectTarget === "synonym"
                  ? "원문에서 단어를 클릭하면 동반의어에 추가됩니다"
                  : "원문에서 단어를 클릭하면 어휘에 추가됩니다"}
              </span>
            </>
          )}
        </div>
      )}

      {mode === "edit" || !vocabReady ? (
        <textarea
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          placeholder="영어 지문 전체를 붙여넣으세요."
          rows={6}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
        />
      ) : (
        <div className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-english leading-relaxed text-foreground min-h-[150px] select-none">
          {words.map((segment, i) => {
            if (/^\s+$/.test(segment)) return <span key={i}>{segment}</span>;
            const cleanWord = segment.replace(/[^a-zA-Z'-]/g, "");
            if (!cleanWord) return <span key={i}>{segment}</span>;
            const isAdding = activeAddingWord === cleanWord.toLowerCase();
            return (
              <span
                key={i}
                onClick={() => handleWordClickInternal(cleanWord)}
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
          className="px-6 py-2 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isGenerating ? "생성 중..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
