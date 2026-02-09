import { useState } from "react";
import { Chunk } from "@/lib/chunk-utils";

const CHUNK_HSL: string[] = [
  "var(--chunk-1)",
  "var(--chunk-2)",
  "var(--chunk-3)",
  "var(--chunk-4)",
  "var(--chunk-5)",
  "var(--chunk-6)",
];

function getChunkStyle(index: number) {
  const hsl = CHUNK_HSL[index % CHUNK_HSL.length];
  return {
    color: `hsl(${hsl})`,
    backgroundColor: `hsl(${hsl} / 0.08)`,
    borderColor: `hsl(${hsl} / 0.25)`,
  };
}

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
    <div className="flex flex-wrap items-center gap-2">
      {chunks.map((chunk, i) => (
        <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1.5">
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
              className="bg-card border border-primary rounded-sm px-2 py-1 text-sm font-english text-foreground outline-none min-w-[100px]"
            />
          ) : (
            <span
              onDoubleClick={() => handleDoubleClick(i)}
              style={getChunkStyle(i)}
              className={`inline-block px-2.5 py-1 rounded-sm text-sm font-english border select-none
                ${!disabled ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
              title={disabled ? "" : 'Double-click to edit'}
            >
              {chunk.text}
            </span>
          )}
          {i < chunks.length - 1 && !disabled && (
            <button
              onClick={() => handleMerge(i)}
              className="text-muted-foreground hover:text-foreground text-sm px-0.5 opacity-30 hover:opacity-100 transition-opacity"
              title="Merge with next"
            >
              +
            </button>
          )}
          {i < chunks.length - 1 && (
            <span className="text-muted-foreground/50 text-sm font-light">/</span>
          )}
        </div>
      ))}
    </div>
  );
}
