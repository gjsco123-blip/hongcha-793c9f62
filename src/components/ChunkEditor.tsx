import { useState, useRef, useCallback } from "react";
import { Chunk, segmentsToWords, wordsToSegments } from "@/lib/chunk-utils";
import { Sparkles, Check, X, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyntaxNote } from "@/pages/Index";

interface ChunkEditorProps {
  chunks: Chunk[];
  onChange: (chunks: Chunk[]) => void;
  disabled?: boolean;
  onAnalyzeSelection?: (selectedText: string, userHint?: string, slotNumber?: number) => void;
  usedSlots?: number[];
  syntaxNotes?: SyntaxNote[];
}

export function ChunkEditor({ chunks, onChange, disabled, onAnalyzeSelection, usedSlots = [], syntaxNotes = [] }: ChunkEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftChunks, setDraftChunks] = useState<Chunk[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showHintInput, setShowHintInput] = useState(false);
  const [hintText, setHintText] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintInputRef = useRef<HTMLTextAreaElement>(null);

  const handleMouseUp = useCallback(() => {
    if (!onAnalyzeSelection) return;
    if (showHintInput) return; // 힌트 입력 중에는 선택 무시
    const selection = window.getSelection();
    const rawText = selection?.toString().trim();
    const text = rawText
      ?.replace(/\s*\/\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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
  }, [onAnalyzeSelection, showHintInput]);

  const handleAnalyzeClick = () => {
    setShowHintInput(true);
    setHintText("");
    // 다음 빈 슬롯 자동 선택
    const nextSlot = [1, 2, 3, 4, 5].find((n) => !usedSlots.includes(n)) || 1;
    setSelectedSlot(nextSlot);
    setTimeout(() => hintInputRef.current?.focus(), 50);
  };

  const handleSubmitWithHint = () => {
    if (selectedText && onAnalyzeSelection) {
      onAnalyzeSelection(selectedText, hintText.trim() || undefined, selectedSlot);
    }
    resetSelection();
  };

  const handleSubmitAuto = () => {
    if (selectedText && onAnalyzeSelection) {
      onAnalyzeSelection(selectedText, undefined, selectedSlot);
    }
    resetSelection();
  };

  const resetSelection = () => {
    setSelectedText("");
    setTooltipPos(null);
    setShowHintInput(false);
    setHintText("");
    window.getSelection()?.removeAllRanges();
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
      if (chunkIndex === 0) return;
      handleMerge(chunkIndex - 1);
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
        {/* Selection tooltip - 기본 버튼 */}
        {tooltipPos && selectedText && !showHintInput && (
          <button
            onClick={handleAnalyzeClick}
            className="absolute z-20 flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-foreground text-background rounded shadow-lg whitespace-nowrap -translate-x-1/2 -translate-y-full"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <Sparkles className="w-3 h-3" />
            선택 구문분석
          </button>
        )}

        {/* 힌트 입력 팝업 */}
        {tooltipPos && selectedText && showHintInput && (
          <div
            className="absolute z-30 bg-card border border-border rounded-lg shadow-xl p-3 w-72 -translate-x-1/2"
            style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 번호 선택 */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-[10px] text-muted-foreground mr-1">번호:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedSlot(n)}
                  className={`w-5 h-5 text-[10px] font-bold border transition-colors ${
                    selectedSlot === n
                      ? "bg-foreground text-background border-foreground"
                      : usedSlots.includes(n)
                      ? "border-border text-muted-foreground bg-muted/50"
                      : "border-border text-foreground hover:border-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
              {usedSlots.includes(selectedSlot) && (
                <span className="text-[9px] text-muted-foreground ml-1">덮어쓰기</span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mb-1.5 truncate">
              선택: <span className="font-english font-medium text-foreground">"{selectedText}"</span>
            </div>
            <textarea
              ref={hintInputRef}
              value={hintText}
              onChange={(e) => setHintText(e.target.value)}
              placeholder="문법 포인트 힌트 입력 (예: 관계대명사, 수동태...)"
              className="w-full bg-muted/50 border border-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitWithHint();
                }
                if (e.key === "Escape") resetSelection();
              }}
            />
            <div className="flex gap-1.5 mt-2">
              <Button
                size="sm"
                onClick={handleSubmitWithHint}
                disabled={!hintText.trim()}
                className="h-6 px-2 text-[10px] gap-1 flex-1"
              >
                <Send className="w-3 h-3" />
                정리하기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmitAuto}
                className="h-6 px-2 text-[10px] gap-1 flex-1"
              >
                <Sparkles className="w-3 h-3" />
                자동생성
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetSelection}
                className="h-6 px-1.5 text-[10px]"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {displayChunks.map((chunk, i) => {
          const words = segmentsToWords(chunk.segments);

          return (
          <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1 max-w-full">
            <span
              className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-english border border-border bg-background text-foreground flex-wrap break-words max-w-full"
            >
              {words.map((w, wi) => (
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
          );
        })}
      </div>
    </div>
  );
}
