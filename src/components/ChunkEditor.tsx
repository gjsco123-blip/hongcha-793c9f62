import { useState, useRef, useCallback } from "react";
import { Chunk, segmentsToWords, wordsToSegments, mergeAdverbsBetweenVerbs } from "@/lib/chunk-utils";
import { Sparkles, Check, X, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import type { SyntaxNote } from "@/pages/Index";
import { computeSvLabels, type SvLabel } from "@/lib/sv-labels";
import { detectSubordinate } from "@/lib/subordinate-detect";

interface ChunkEditorProps {
  chunks: Chunk[];
  onChange: (chunks: Chunk[]) => void;
  disabled?: boolean;
  onAnalyzeSelection?: (selectedText: string, userHint?: string, slotNumber?: number) => void;
  usedSlots?: number[];
  syntaxNotes?: SyntaxNote[];
}

export function ChunkEditor({ chunks, onChange, disabled, onAnalyzeSelection, usedSlots = [], syntaxNotes = [] }: ChunkEditorProps) {
  const subjectUnderlineEnabled = useFeatureFlag("subject_underline");
  const svLabelsEnabled = useFeatureFlag("sv_labels");
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
  const [roleMenu, setRoleMenu] = useState<
    | { x: number; y: number; chunkIndex: number; wordIndex: number }
    | null
  >(null);

  const handleMouseUp = useCallback(() => {
    if (!onAnalyzeSelection) return;
    if (showHintInput) return; // 힌트 입력 중에는 선택 무시
    const selection = window.getSelection();
    const rawText = selection?.toString().trim();
    const text = rawText
      ?.replace(/\s*\/\s*/g, " ")
      .replace(/\b[sv]['′]?[₀-₉]?\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && text.length >= 1 && containerRef.current?.contains(selection?.anchorNode ?? null)) {
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
    // Ignore punctuation-only tokens like dash/em-dash.
    if (!/[A-Za-z]/.test(words[wordIndex]?.word || "")) return;
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

  const applyRole = (
    chunkIndex: number,
    wordIndex: number,
    role: "s" | "v" | "none",
  ) => {
    const target = isEditing ? draftChunks : chunks;
    const chunk = target[chunkIndex];
    const words = segmentsToWords(chunk.segments);
    if (!/[A-Za-z]/.test(words[wordIndex]?.word || "")) return;

    const isSubordinate =
      role === "none" ? false : detectSubordinate(target, chunkIndex, wordIndex);

    words[wordIndex] = {
      ...words[wordIndex],
      isVerb: role === "v",
      isSubject: role === "s",
      isSubordinate,
      groupId: undefined,
    };
    const newSegments = wordsToSegments(words);

    if (isEditing) {
      const newChunks = draftChunks.map((c, i) =>
        i === chunkIndex ? { ...c, segments: newSegments } : c,
      );
      setDraftChunks(newChunks);
    } else {
      const newChunks = chunks.map((c, i) =>
        i === chunkIndex ? { ...c, segments: newSegments } : c,
      );
      onChange(newChunks);
    }
  };

  const handleWordContextMenu = (
    e: React.MouseEvent,
    chunkIndex: number,
    wordIndex: number,
  ) => {
    if (!isEditing) return;
    const target = isEditing ? draftChunks : chunks;
    const chunk = target[chunkIndex];
    const words = segmentsToWords(chunk.segments);
    if (!/[A-Za-z]/.test(words[wordIndex]?.word || "")) return;
    e.preventDefault();
    e.stopPropagation();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setRoleMenu({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      chunkIndex,
      wordIndex,
    });
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
  const svMap = svLabelsEnabled ? computeSvLabels(displayChunks) : null;

  // Compute per-chunk word-level labels using the SAME merge logic as the PDF
  // (mergeAdverbsBetweenVerbs) so phrases like "are even happily endorsed" get
  // a single label instead of two. Word indices remain based on the ORIGINAL
  // segments (so click/double-click/contextmenu coordinates are unchanged).
  const wordLabelLookup = (() => {
    const map = new Map<string, SvLabel>();
    if (!svMap) return map;
    displayChunks.forEach((c, ci) => {
      const { segments: mergedSegs, indexMap } = mergeAdverbsBetweenVerbs(c.segments);
      // Pick first label found per merged segment.
      const mergedLabels = new Map<number, SvLabel>();
      for (let oi = 0; oi < c.segments.length; oi++) {
        const lbl = svMap.get(`${ci}:${oi}`);
        if (lbl && !mergedLabels.has(indexMap[oi])) {
          mergedLabels.set(indexMap[oi], lbl);
        }
      }
      // Word offsets per ORIGINAL segment (so we can resolve word positions).
      const segWordCounts = c.segments.map(
        (seg) => seg.text.split(/(\s+)/).filter((p) => p.trim()).length,
      );
      const segWordStart: number[] = [];
      let acc = 0;
      for (const n of segWordCounts) {
        segWordStart.push(acc);
        acc += n;
      }
      // For each merged segment with a label, find its original-word range and
      // place the marker under the LAST word for verbs, FIRST word for subjects.
      mergedSegs.forEach((_, mi) => {
        const lbl = mergedLabels.get(mi);
        if (!lbl) return;
        // Original segments that map to this merged segment.
        let firstWord = Infinity;
        let lastWord = -Infinity;
        for (let oi = 0; oi < c.segments.length; oi++) {
          if (indexMap[oi] !== mi) continue;
          const start = segWordStart[oi];
          const end = start + segWordCounts[oi] - 1;
          if (segWordCounts[oi] === 0) continue;
          if (start < firstWord) firstWord = start;
          if (end > lastWord) lastWord = end;
        }
        if (firstWord === Infinity) return;
        const target = lbl.base === "v" ? lastWord : firstWord;
        map.set(`${ci}:${target}`, lbl);
      });
    });
    return map;
  })();

  const renderSvLabel = (lbl: SvLabel) => (
    <span
      className="inline-flex flex-col items-center align-baseline select-none"
      style={{ height: 0, overflow: "visible", userSelect: "none" }}
      aria-hidden="true"
    >
      <span
        className="text-[12px] leading-none text-black font-sans select-none"
        style={{ marginTop: 3, userSelect: "none" }}
      >
        {lbl.base}
        {lbl.prime ? "'" : ""}
        {lbl.index !== undefined && (
          <sub className="text-[9px]" style={{ lineHeight: 1 }}>{lbl.index}</sub>
        )}
      </span>
    </span>
  );

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

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        onClick={() => roleMenu && setRoleMenu(null)}
        className="relative flex flex-wrap items-center gap-x-1.5 gap-y-5"
      >
        {/* Role context menu (right-click) */}
        {roleMenu && (
          <div
            className="absolute z-30 bg-card border border-border rounded-md shadow-xl py-1 min-w-[110px]"
            style={{ left: roleMenu.x, top: roleMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/80"
              onClick={() => {
                applyRole(roleMenu.chunkIndex, roleMenu.wordIndex, "s");
                setRoleMenu(null);
              }}
            >
              주어 표시
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-muted/80"
              onClick={() => {
                applyRole(roleMenu.chunkIndex, roleMenu.wordIndex, "v");
                setRoleMenu(null);
              }}
            >
              동사 표시
            </button>
            <button
              className="w-full text-left px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-muted/80"
              onClick={() => {
                applyRole(roleMenu.chunkIndex, roleMenu.wordIndex, "none");
                setRoleMenu(null);
              }}
            >
              표시 해제
            </button>
          </div>
        )}

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
            <span className={`inline px-2 py-1 text-xs font-english text-foreground break-words max-w-full ${
              isEditing ? "border border-border rounded-md bg-background" : ""
            }`}>
              {words.map((w, wi) => (
                <span key={wi}>
                  <span className="inline-flex flex-col items-center align-baseline">
                    <span
                      onClick={isEditing ? () => handleWordInteraction(i, wi) : undefined}
                      onDoubleClick={isEditing ? () => handleWordDoubleClick(i, wi) : undefined}
                      onContextMenu={isEditing ? (e) => handleWordContextMenu(e, i, wi) : undefined}
                      className={`${(w.isVerb || (subjectUnderlineEnabled && w.isSubject)) && /[A-Za-z]/.test(w.word) ? "underline decoration-foreground decoration-2 underline-offset-[3px]" : ""}
                        ${isEditing ? "cursor-pointer hover:bg-muted/80 rounded-sm" : ""}`}
                      title={isEditing ? "클릭: 분할 · 더블클릭: 동사 · 우클릭: 주어/동사/해제" : ""}
                    >
                      {w.word}
                    </span>
                    {wordLabelLookup.get(`${i}:${wi}`)
                      ? renderSvLabel(wordLabelLookup.get(`${i}:${wi}`)!)
                      : null}
                  </span>
                  {wi < words.length - 1 ? " " : ""}
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
              <span className="text-muted-foreground text-xs ml-1">/</span>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
