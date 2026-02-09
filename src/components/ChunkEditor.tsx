import { useState } from "react";
import { Chunk, segmentsToWords, wordsToSegments } from "@/lib/chunk-utils";
import { Pencil } from "lucide-react";

interface ChunkEditorProps {
  chunks: Chunk[];
  onChange: (chunks: Chunk[]) => void;
  disabled?: boolean;
}

export function ChunkEditor({ chunks, onChange, disabled }: ChunkEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    setEditValue(chunks[index].text);
  };

  const handleSave = () => {
    if (editingIndex === null) return;
    const newChunks = [...chunks];
    const parts = editValue.split(" / ").map((p) => p.trim()).filter(Boolean);

    if (parts.length === 1) {
      newChunks[editingIndex] = {
        ...newChunks[editingIndex],
        text: parts[0],
        segments: [{ text: parts[0], isVerb: false }],
      };
    } else {
      newChunks.splice(
        editingIndex,
        1,
        ...parts.map((text, i) => ({
          tag: editingIndex + i + 1,
          text,
          segments: [{ text, isVerb: false }],
        }))
      );
      newChunks.forEach((c, i) => (c.tag = i + 1));
    }

    onChange(newChunks);
    setEditingIndex(null);
  };

  const handleMerge = (index: number) => {
    if (index >= chunks.length - 1) return;
    const newChunks = [...chunks];
    const mergedSegments = [
      ...newChunks[index].segments,
      { text: " ", isVerb: false },
      ...newChunks[index + 1].segments,
    ];
    // Consolidate adjacent same-type segments
    const consolidated = wordsToSegments(
      segmentsToWords(mergedSegments)
    );
    newChunks[index] = {
      tag: newChunks[index].tag,
      text: `${newChunks[index].text} ${newChunks[index + 1].text}`,
      segments: consolidated,
    };
    newChunks.splice(index + 1, 1);
    newChunks.forEach((c, i) => (c.tag = i + 1));
    onChange(newChunks);
  };

  const handleVerbToggle = (chunkIndex: number, wordIndex: number) => {
    if (disabled) return;
    const chunk = chunks[chunkIndex];
    const words = segmentsToWords(chunk.segments);
    words[wordIndex] = { ...words[wordIndex], isVerb: !words[wordIndex].isVerb };
    const newSegments = wordsToSegments(words);
    const newChunks = chunks.map((c, i) =>
      i === chunkIndex ? { ...c, segments: newSegments } : c
    );
    onChange(newChunks);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chunks.map((chunk, i) => (
        <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1">
          {editingIndex === i ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditingIndex(null);
              }}
              className="bg-card border border-foreground px-2 py-1 text-xs font-english text-foreground outline-none min-w-[80px]"
            />
          ) : (
            <span
              className={`inline-flex items-center gap-0.5 px-2 py-1 text-xs font-english border border-border bg-background text-foreground group
                ${!disabled ? "cursor-default" : ""}`}
            >
              {segmentsToWords(chunk.segments).map((w, wi) => (
                <span
                  key={wi}
                  onDoubleClick={() => handleVerbToggle(i, wi)}
                  className={`${w.isVerb ? "underline decoration-foreground decoration-2 underline-offset-[3px]" : ""}
                    ${!disabled ? "cursor-pointer hover:bg-muted/80 rounded-sm" : ""}`}
                  title={disabled ? "" : "더블클릭: 동사 표시 토글"}
                >
                  {w.word}
                </span>
              ))}
              {!disabled && (
                <button
                  onClick={() => handleStartEdit(i)}
                  className="ml-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  title="청크 편집"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          )}
          {i < chunks.length - 1 && !disabled && (
            <button
              onClick={() => handleMerge(i)}
              className="text-muted-foreground hover:text-foreground text-xs px-0.5 opacity-30 hover:opacity-100 transition-opacity"
              title="Merge with next"
            >
              +
            </button>
          )}
          {i < chunks.length - 1 && (
            <span className="text-muted-foreground text-xs">/</span>
          )}
        </div>
      ))}
    </div>
  );
}
