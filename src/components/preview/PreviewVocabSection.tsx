import { useState } from "react";
import { Loader2, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { VocabItem, SectionStatus } from "./types";

const PDF_MEANING_MAX_CHARS = 9;

interface Props {
  vocab: VocabItem[];
  status: SectionStatus;
  onDelete: (index: number) => void;
  onEdit: (index: number, field: keyof VocabItem, value: string) => void;
  onRegenItem?: (index: number) => Promise<void>;
}

export function PreviewVocabSection({ vocab, status, onDelete, onEdit, onRegenItem }: Props) {
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (status === "idle") return null;

  const LoadingDot = () => <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline-block" />;

  const handleRegen = async (globalIdx: number) => {
    if (!onRegenItem || regenIdx !== null) return;
    setOpenIdx(null);
    setRegenIdx(globalIdx);
    try {
      await onRegenItem(globalIdx);
    } finally {
      setRegenIdx(null);
    }
  };

  const handleDelete = (globalIdx: number) => {
    setOpenIdx(null);
    onDelete(globalIdx);
  };

  const columns = [0, 1, 2].map((colIdx) => {
    const items = vocab.slice(colIdx * 10, colIdx * 10 + 10);
    const padded = Array.from({ length: 10 }, (_, i) => items[i] || null);
    return { startNum: colIdx * 10 + 1, rows: padded };
  });

  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 flex items-center gap-2">
        Vocabulary ({vocab.length}/30)
        {status === "loading" && <LoadingDot />}
      </h2>
      {status === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
            {col.rows.map((v, i) => {
              const globalIdx = colIdx * 10 + i;
              const num = globalIdx + 1;
              if (!v) {
                return (
                  <div key={num} className="flex items-center gap-2 px-2 py-1.5 text-xs h-[30px]">
                    <span className="w-4 text-center text-muted-foreground/30 text-[10px]">{num}</span>
                  </div>
                );
              }
              const isOverflow = v.meaning_ko.length > PDF_MEANING_MAX_CHARS;
              const isRegening = regenIdx === globalIdx;
              return (
                <div key={num} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <span className="w-4 text-center text-muted-foreground/50 text-[10px]">{num}</span>
                  <Popover open={openIdx === globalIdx} onOpenChange={(open) => setOpenIdx(open ? globalIdx : null)}>
                    <PopoverTrigger asChild>
                      <button
                        className="font-english font-semibold min-w-[55px] whitespace-nowrap text-left hover:text-primary transition-colors cursor-pointer bg-transparent border-none outline-none p-0"
                      >
                        {isRegening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : v.word}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-auto p-1 flex gap-1">
                      <button
                        onClick={() => handleRegen(globalIdx)}
                        disabled={regenIdx !== null}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        재생성
                      </button>
                      <button
                        onClick={() => handleDelete(globalIdx)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </button>
                    </PopoverContent>
                  </Popover>
                  <input
                    value={v.pos}
                    onChange={(e) => onEdit(globalIdx, "pos", e.target.value)}
                    className="w-7 text-center text-[10px] text-muted-foreground/60 bg-transparent border-none outline-none focus:bg-muted/30 rounded px-0"
                  />
                  <div className="flex-1 flex items-center gap-0.5">
                    <input
                      value={v.meaning_ko}
                      onChange={(e) => onEdit(globalIdx, "meaning_ko", e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none focus:bg-muted/30 rounded px-0.5 text-xs"
                    />
                    {isOverflow && (
                      <span title="PDF에서 2줄로 넘어갈 수 있습니다">
                        <AlertTriangle className="w-3 h-3 text-destructive/70 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
