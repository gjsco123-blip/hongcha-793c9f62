import { useState, useRef, useEffect } from "react";
import { Chunk, mergeAdverbsBetweenVerbs } from "@/lib/chunk-utils";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

interface ResultDisplayProps {
  label: string;
  chunks?: Chunk[];
  text?: string;
  isKorean?: boolean;
  onTextChange?: (text: string) => void;
  onChunkTextChange?: (index: number, text: string) => void;
}

export function ResultDisplay({ label, chunks, text, isKorean, onTextChange, onChunkTextChange }: ResultDisplayProps) {
  const subjectUnderlineEnabled = useFeatureFlag("subject_underline");
  const [editingText, setEditingText] = useState(false);
  const [editingChunkIdx, setEditingChunkIdx] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftChunk, setDraftChunk] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const chunkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingText && textRef.current) {
      textRef.current.focus();
      textRef.current.select();
    }
  }, [editingText]);

  useEffect(() => {
    if (editingChunkIdx !== null && chunkRef.current) {
      chunkRef.current.focus();
      chunkRef.current.select();
    }
  }, [editingChunkIdx]);

  const commitText = () => {
    if (onTextChange && draftText !== text) {
      onTextChange(draftText);
    }
    setEditingText(false);
  };

  const commitChunk = () => {
    if (onChunkTextChange && editingChunkIdx !== null) {
      onChunkTextChange(editingChunkIdx, draftChunk);
    }
    setEditingChunkIdx(null);
  };

  return (
    <div className="flex items-start gap-3">
      <div className="w-0.5 h-4 bg-foreground shrink-0 mt-[3px]" />
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 pt-[3px]">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {chunks ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {chunks.map((chunk, i) => (
              <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1 max-w-full">
                {editingChunkIdx === i && onChunkTextChange ? (
                  <input
                    ref={chunkRef}
                    value={draftChunk}
                    onChange={(e) => setDraftChunk(e.target.value)}
                    onBlur={commitChunk}
                    onKeyDown={(e) => { if (e.key === "Enter") commitChunk(); if (e.key === "Escape") setEditingChunkIdx(null); }}
                    className="inline-block px-2 py-1 text-xs border border-foreground rounded-md bg-background font-sans outline-none min-w-[40px]"
                    style={{ width: `${Math.max(draftChunk.length * 0.7 + 2, 3)}em` }}
                  />
                ) : (
                  <span
                    className={`inline-block px-2 py-1 text-xs border border-border rounded-md bg-background break-words max-w-full ${
                      isKorean ? "font-sans" : "font-english"
                    } ${onChunkTextChange ? "cursor-pointer hover:border-foreground transition-colors" : ""}`}
                    onClick={() => {
                      if (onChunkTextChange) {
                        setEditingChunkIdx(i);
                        setDraftChunk(chunk.text);
                      }
                    }}
                  >
                    {!isKorean
                      ? mergeAdverbsBetweenVerbs(chunk.segments).segments.map((seg, si) => (
                          <span
                            key={si}
                            className={
                              seg.isVerb || (subjectUnderlineEnabled && seg.isSubject)
                                ? "underline decoration-foreground decoration-2 underline-offset-[3px]"
                                : ""
                            }
                          >
                            {seg.text}
                          </span>
                        ))
                      : chunk.text}
                  </span>
                )}
                {i < chunks.length - 1 && (
                  <span className="text-muted-foreground text-xs">/</span>
                )}
              </div>
            ))}
          </div>
        ) : editingText && onTextChange ? (
          <textarea
            ref={textRef}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => { if (e.key === "Escape") setEditingText(false); }}
            className={`w-full text-sm leading-relaxed bg-background border border-foreground rounded-md px-2 py-1 outline-none resize-y min-h-[2em] ${
              isKorean ? "font-sans" : "font-english"
            } text-foreground`}
            rows={2}
          />
        ) : (
          <p
            className={`text-sm leading-relaxed ${
              isKorean ? "font-sans" : "font-english"
            } text-foreground ${onTextChange ? "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors" : ""}`}
            onClick={() => {
              if (onTextChange) {
                setDraftText(text || "");
                setEditingText(true);
              }
            }}
          >
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
