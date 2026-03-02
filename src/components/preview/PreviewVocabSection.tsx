import { useState } from "react";
import { Loader2, Trash2, AlertTriangle, ClipboardPaste } from "lucide-react";
import { VocabPasteDialog } from "./VocabPasteDialog";
import type { VocabItem, SectionStatus } from "./types";

const PDF_MEANING_MAX_CHARS = 9;
const TOTAL_SLOTS = 40;
const COL_SIZES = [14, 13, 13];

interface Props {
  vocab: VocabItem[];
  status: SectionStatus;
  passage: string;
  onDelete: (index: number) => void;
  onEdit: (index: number, field: keyof VocabItem, value: string) => void;
  onBulkAdd: (items: VocabItem[]) => void;
}

export function PreviewVocabSection({ vocab, status, passage, onDelete, onEdit, onBulkAdd }: Props) {
  const [pasteOpen, setPasteOpen] = useState(false);

  if (status === "idle") return null;

  const LoadingDot = () => <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline-block" />;

  // 3 columns: 14/13/13 rows
  let offset = 0;
  const columns = COL_SIZES.map((size, colIdx) => {
    const items = vocab.slice(offset, offset + size);
    const startNum = offset + 1;
    offset += size;
    return { startNum, rows: Array.from({ length: size }, (_, i) => items[i] || null), size };
  });

  // Calculate global index from column index and row index
  const getGlobalIdx = (colIdx: number, rowIdx: number) => {
    let idx = 0;
    for (let c = 0; c < colIdx; c++) idx += COL_SIZES[c];
    return idx + rowIdx;
  };

  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 flex items-center gap-2">
        Vocabulary ({vocab.length}/{TOTAL_SLOTS})
        {status === "loading" && <LoadingDot />}
        <button
          onClick={() => setPasteOpen(true)}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded"
          title="외부 단어 붙여넣기"
        >
          <ClipboardPaste className="w-3 h-3" /> 붙여넣기
        </button>
      </h2>
      {status === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="border border-border/60 divide-y divide-border/40">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="w-4 text-center">#</span>
              <span className="min-w-[45px] flex-shrink-0">Word</span>
              <span className="w-7 text-center">POS</span>
              <span className="flex-1">Meaning</span>
              <span className="w-5" />
            </div>
            {col.rows.map((v, i) => {
              const globalIdx = getGlobalIdx(colIdx, i);
              const num = globalIdx + 1;
              if (!v) {
                return (
                  <div key={num} className="flex items-center gap-2 px-2 py-1.5 text-xs h-[30px]">
                    <span className="w-4 text-center text-muted-foreground/30 text-[10px]">{num}</span>
                  </div>
                );
              }
              const isOverflow = v.meaning_ko.length > PDF_MEANING_MAX_CHARS;
              return (
                <div key={num} className="group flex items-center gap-2 px-2 py-1.5 text-xs">
                  <span className="w-4 text-center text-muted-foreground/50 text-[10px]">{num}</span>
                  <span className="font-english font-semibold min-w-[45px] max-w-[70px] truncate flex-shrink-0" title={v.word}>{v.word}</span>
                  <input
                    value={v.pos}
                    onChange={(e) => onEdit(globalIdx, "pos", e.target.value)}
                    className="w-7 text-center text-[10px] text-muted-foreground/60 bg-transparent border-none outline-none focus:bg-muted/30 rounded px-0"
                  />
                  <div className="flex-1 flex items-center gap-0.5 min-w-0">
                    <input
                      value={v.meaning_ko}
                      onChange={(e) => onEdit(globalIdx, "meaning_ko", e.target.value)}
                      className="flex-1 min-w-0 bg-transparent border-none outline-none focus:bg-muted/30 rounded px-0.5 text-xs"
                    />
                    {isOverflow && (
                      <span title="PDF에서 2줄로 넘어갈 수 있습니다">
                        <AlertTriangle className="w-3 h-3 text-destructive/70 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(globalIdx)}
                    className="w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <VocabPasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        passage={passage}
        existingWords={vocab.map((v) => v.word.toLowerCase())}
        currentCount={vocab.length}
        onAdd={onBulkAdd}
      />
    </section>
  );
}
