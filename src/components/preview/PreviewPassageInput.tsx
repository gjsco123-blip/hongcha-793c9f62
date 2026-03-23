import { useState, useRef, useEffect } from "react";
import { X, Check } from "lucide-react";

type SelectTarget = "vocab" | "synonym";

interface Props {
  passage: string;
  setPassage: (v: string) => void;
  onPassageBlur?: () => void;
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
  passage, setPassage, onPassageBlur, isGenerating, onGenerate, vocabReady,
  onWordClick, addingWord,
  synonymSelectMode, onSynonymWordClick, addingSynonymWord,
}: Props) {
  const [mode, setMode] = useState<"edit" | "select">("edit");
  const [selectTarget, setSelectTarget] = useState<SelectTarget>("vocab");
  const [selectedWords, setSelectedWords] = useState<{ word: string; index: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (synonymSelectMode) {
      setMode("select");
      setSelectTarget("synonym");
      setSelectedWords([]);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [synonymSelectMode]);

  // Clear buffer when switching away from synonym mode
  useEffect(() => {
    if (selectTarget !== "synonym" || mode !== "select") {
      setSelectedWords([]);
    }
  }, [selectTarget, mode]);

  const words = passage.split(/(\s+)/);

  const activeSelectTarget = synonymSelectMode ? "synonym" : selectTarget;

  const handleWordClickInternal = (word: string, wordIndex: number) => {
    if (activeSelectTarget === "synonym") {
      // Multi-word buffer mode for synonyms
      setSelectedWords((prev) => {
        const exists = prev.find((w) => w.index === wordIndex);
        if (exists) return prev.filter((w) => w.index !== wordIndex);
        return [...prev, { word, index: wordIndex }].sort((a, b) => a.index - b.index);
      });
    } else {
      onWordClick(word);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedWords.length === 0 || !onSynonymWordClick) return;
    const combined = selectedWords.map((w) => w.word).join(" ");
    onSynonymWordClick(combined);
    setSelectedWords([]);
  };

  const handleClearSelection = () => {
    setSelectedWords([]);
  };

  const activeAddingWord = activeSelectTarget === "synonym" ? addingSynonymWord : addingWord;
  const selectedIndices = new Set(selectedWords.map((w) => w.index));

  // Build word index mapping: for each non-whitespace segment, track its word index
  let wordCounter = 0;
  const wordIndices: (number | null)[] = words.map((segment) => {
    if (/^\s+$/.test(segment)) return null;
    const cleanWord = segment.replace(/[^a-zA-Z'-]/g, "");
    if (!cleanWord) return null;
    return wordCounter++;
  });

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
                  ? "단어를 클릭하여 선택 후 ✓ 버튼으로 추가 (숙어는 여러 단어 선택)"
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
          onBlur={onPassageBlur}
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
            const wi = wordIndices[i];
            const isSelected = wi !== null && selectedIndices.has(wi);
            const isAdding = activeAddingWord === cleanWord.toLowerCase();
            return (
              <span
                key={i}
                onClick={() => wi !== null && handleWordClickInternal(cleanWord, wi)}
                className={`cursor-pointer rounded px-0.5 transition-colors ${
                  isSelected
                    ? "bg-primary/30 text-primary ring-1 ring-primary/40"
                    : isAdding
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

      {/* Multi-word selection confirmation bar */}
      {activeSelectTarget === "synonym" && mode === "select" && selectedWords.length > 0 && (
        <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-muted/50 rounded-lg border border-border">
          <span className="text-[11px] text-foreground font-medium flex-1">
            {selectedWords.map((w) => w.word).join(" ")}
          </span>
          <button
            onClick={handleClearSelection}
            className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
            title="선택 초기화"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={!!addingSynonymWord}
            className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-foreground text-background font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Check className="w-3 h-3" />
            추가
          </button>
        </div>
      )}

      <div className="flex justify-end mt-3">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !passage.trim()}
          className="px-4 py-1.5 rounded-full bg-foreground text-background text-[11px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isGenerating ? "생성 중..." : "Generate"}
        </button>
      </div>
    </div>
  );
}
