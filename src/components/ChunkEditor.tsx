import { useState, useRef, useCallback } from "react";
import { Chunk, segmentsToWords, wordsToSegments } from "@/lib/chunk-utils";
import { Sparkles, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChunkEditorProps {
  chunks: Chunk[];
  onChange: (chunks: Chunk[]) => void;
  disabled?: boolean;
  onAnalyzeSelection?: (selectedText: string) => void;
}

export function ChunkEditor({ chunks, onChange, disabled, onAnalyzeSelection }: ChunkEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftChunks, setDraftChunks] = useState<Chunk[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseUp = useCallback(() => {
    if (!onAnalyzeSelection) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 2 && containerRef.current?.contains(selection?.anchorNode ?? null)) {
      const range = selection!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      setSelectedText(text);
      setTooltipPos({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      });
    } else {
      setSelectedText("");
      setTooltipPos(null);
    }
  }, [onAnalyzeSelection]);

  const handleAnalyzeClick = () => {
    if (selectedText && onAnalyzeSelection) {
      onAnalyzeSelection(selectedText);
      setSelectedText("");
      setTooltipPos(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleEnterEdit = () => {
    setIsEditing(true);
    setDraftChunks(chunks.map(c => ({ ...c, segments: [...c.segments] })));
  };

  const handleApply = () => {
    onChange(draftChunks);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraftChunks([]);
  };

  const handleWordClick = (chunkIndex: number, wordIndex: number) => {
    if (wordIndex === 0) {
      if (chunkIndex === 0) return; // 맨 첫 단어는 무시
      handleMerge(chunkIndex - 1); // 이전 청크와 병합 (분할 해제)
      return;
    }
    const chunk = draftChunks[chunkIndex];
    const words = segmentsToWords(chunk.segments);
    const beforeWords = words.slice(0, wordIndex);
    const afterWords = words.slice(wordIndex);

    const beforeChunk: Chunk = {
      tag: chunk.tag,
      text: beforeWords.map(w => w.word).join(" "),
      segments: wordsToSegments(beforeWords),
    };
    const afterChunk: Chunk = {
      tag: chunk.tag + 1,
      text: afterWords.map(w => w.word).join(" "),
      segments: wordsToSegments(afterWords),
    };

    const newChunks = [...draftChunks];
    newChunks.splice(chunkIndex, 1, beforeChunk, afterChunk);
    newChunks.forEach((c, i) => (c.tag = i + 1));
    setDraftChunks(newChunks);
  };

  const handleVerbToggle = (chunkIndex: number, wordIndex: number) => {
    const target = isEditing ? draftChunks : chunks;
    const chunk = target[chunkIndex];
    const words = segmentsToWords(chunk.segments);
    words[wordIndex] = { ...words[wordIndex], isVerb: !words[wordIndex].isVerb };
    const newSegments = wordsToSegments(words);

    if (isEditing) {
      const newChunks = draftChunks.map((c, i) =>
        i === chunkIndex ? { ...c, segments: newSegments } : c
      );
      setDraftChunks(newChunks);
    } else {
      const newChunks = chunks.map((c, i) =>
        i === chunkIndex ? { ...c, segments: newSegments } : c
      );
      onChange(newChunks);
    }
  };

  const handleMerge = (index: number) => {
    if (index >= draftChunks.length - 1) return;
    const newChunks = [...draftChunks];
    const mergedSegments = [
      ...newChunks[index].segments,
      { text: " ", isVerb: false },
      ...newChunks[index + 1].segments,
    ];
    const consolidated = wordsToSegments(segmentsToWords(mergedSegments));
    newChunks[index] = {
      tag: newChunks[index].tag,
      text: `${newChunks[index].text} ${newChunks[index + 1].text}`,
      segments: consolidated,
    };
    newChunks.splice(index + 1, 1);
    newChunks.forEach((c, i) => (c.tag = i + 1));
    setDraftChunks(newChunks);
  };

  const handleWordInteraction = (chunkIndex: number, wordIndex: number) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickTimerRef.current = setTimeout(() => {
      handleWordClick(chunkIndex, wordIndex);
      clickTimerRef.current = null;
    }, 250);
  };

  const handleWordDoubleClick = (chunkIndex: number, wordIndex: number) => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    handleVerbToggle(chunkIndex, wordIndex);
  };

  const displayChunks = isEditing ? draftChunks : chunks;

  return (
    <div className="space-y-2">
      {/* Edit mode controls */}
      {!disabled && (
        <div className="flex items-center gap-1.5">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEnterEdit} className="h-6 px-2 text-[10px] gap-1">
              <Pencil className="w-3 h-3" />
              편집
            </Button>
          ) : (
            <>
              <Button variant="default" size="sm" onClick={handleApply} className="h-6 px-2 text-[10px] gap-1">
                <Check className="w-3 h-3" />
                적용
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel} className="h-6 px-2 text-[10px] gap-1">
                <X className="w-3 h-3" />
                취소
              </Button>
            </>
          )}
        </div>
      )}

      <div ref={containerRef} onMouseUp={handleMouseUp} className="relative flex flex-wrap items-center gap-1.5">
        {/* Selection analyze tooltip */}
        {tooltipPos && selectedText && (
          <button
            onClick={handleAnalyzeClick}
            className="absolute z-20 flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-foreground text-background rounded shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <Sparkles className="w-3 h-3" />
            선택 구문분석
          </button>
        )}
        {displayChunks.map((chunk, i) => (
          <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1 max-w-full">
            <span
              className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-english border border-border bg-background text-foreground flex-wrap break-words max-w-full"
            >
              {segmentsToWords(chunk.segments).map((w, wi) => (
                <span
                  key={wi}
                  onClick={isEditing ? () => handleWordInteraction(i, wi) : undefined}
                  onDoubleClick={isEditing ? () => handleWordDoubleClick(i, wi) : undefined}
                  className={`${w.isVerb ? "underline decoration-foreground decoration-2 underline-offset-[3px]" : ""}
                    ${isEditing ? "cursor-pointer hover:bg-muted/80 rounded-sm" : ""}`}
                  title={isEditing ? "클릭: 분할 / 더블클릭: 동사 표시" : ""}
                >
                  {w.word}
                </span>
              ))}
            </span>
            {i < displayChunks.length - 1 && isEditing && (
              <button
                onClick={() => handleMerge(i)}
                className="text-muted-foreground hover:text-foreground text-xs px-0.5 opacity-30 hover:opacity-100 transition-opacity"
                title="다음 청크와 병합"
              >
                +
              </button>
            )}
            {i < displayChunks.length - 1 && (
              <span className="text-muted-foreground text-xs">/</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
