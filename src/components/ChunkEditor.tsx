import { useState } from "react";
import { Chunk } from "@/lib/chunk-utils";

interface ChunkEditorProps {
  chunks: Chunk[];
  onChange: (chunks: Chunk[]) => void;
  disabled?: boolean;
}

export function ChunkEditor({ chunks, onChange, disabled }: ChunkEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleDoubleClick = (index: number) => {
    if (disabled) return;
    setEditingIndex(index);
    setEditValue(chunks[index].text);
  };

  const handleSave = () => {
    if (editingIndex === null) return;
    const newChunks = [...chunks];
    const parts = editValue.split(" / ").map((p) => p.trim()).filter(Boolean);

    if (parts.length === 1) {
      newChunks[editingIndex] = { ...newChunks[editingIndex], text: parts[0] };
    } else {
      newChunks.splice(
        editingIndex,
        1,
        ...parts.map((text, i) => ({ tag: editingIndex + i + 1, text }))
      );
      newChunks.forEach((c, i) => (c.tag = i + 1));
    }

    onChange(newChunks);
    setEditingIndex(null);
  };

  const handleMerge = (index: number) => {
    if (index >= chunks.length - 1) return;
    const newChunks = [...chunks];
    newChunks[index] = {
      tag: newChunks[index].tag,
      text: `${newChunks[index].text} ${newChunks[index + 1].text}`,
    };
    newChunks.splice(index + 1, 1);
    newChunks.forEach((c, i) => (c.tag = i + 1));
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
              onDoubleClick={() => handleDoubleClick(i)}
              className={`inline-block px-2 py-1 text-xs font-english border border-border bg-background text-foreground
                ${!disabled ? "cursor-pointer hover:border-foreground hover:bg-muted" : "cursor-default"}`}
              title={disabled ? "" : "Double-click to edit"}
            >
              {chunk.text}
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
