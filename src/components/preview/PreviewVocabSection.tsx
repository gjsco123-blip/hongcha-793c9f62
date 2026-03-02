import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import type { VocabItem, SectionStatus } from "./types";

// PDF meaning column: ~59pt available at 6.5pt font → ~9 Korean chars per line
const PDF_MEANING_MAX_CHARS = 9;
const TOTAL_SLOTS = 40;
const COLS = 4;
const ROWS_PER_COL = 10;

export interface PhraseItem {
  phrase: string;
  meaning_ko: string;
}

interface Props {
  vocab: VocabItem[];
  phrases?: PhraseItem[];
  status: SectionStatus;
  onDelete: (index: number) => void;
  onEdit: (index: number, field: keyof VocabItem, value: string) => void;
  onDeletePhrase?: (index: number) => void;
}

export function PreviewVocabSection({ vocab, phrases = [], status, onDelete, onEdit, onDeletePhrase }: Props) {
  if (status === "idle") return null;

  const LoadingDot = () => <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline-block" />;

  // 4 columns of 10 rows
  const columns = Array.from({ length: COLS }, (_, colIdx) => {
    const items = vocab.slice(colIdx * ROWS_PER_COL, colIdx * ROWS_PER_COL + ROWS_PER_COL);
    const padded = Array.from({ length: ROWS_PER_COL }, (_, i) => items[i] || null);
    return { startNum: colIdx * ROWS_PER_COL + 1, rows: padded };
  });

  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 flex items-center gap-2">
        Vocabulary ({vocab.length}/{TOTAL_SLOTS})
        {status === "loading" && <LoadingDot />}
      </h2>
      {status === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-3">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="border border-border/60 divide-y divide-border/40">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span className="w-4 text-center">#</span>
              <span className="min-w-[48px]">Word</span>
              <span className="w-6 text-center">POS</span>
              <span className="flex-1">Meaning</span>
              <span className="w-5" />
            </div>
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
              return (
                <div key={num} className="group flex items-center gap-2 px-2 py-1.5 text-xs">
                  <span className="w-4 text-center text-muted-foreground/50 text-[10px]">{num}</span>
                  <span className="font-english font-semibold min-w-[48px] whitespace-nowrap text-[11px]">{v.word}</span>
                  <input
                    value={v.pos}
                    onChange={(e) => onEdit(globalIdx, "pos", e.target.value)}
                    className="w-6 text-center text-[10px] text-muted-foreground/60 bg-transparent border-none outline-none focus:bg-muted/30 rounded px-0"
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

      {/* Phrases section */}
      {phrases.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Phrases ({phrases.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-3">
            {phrases.map((p, i) => (
              <div key={i} className="group flex items-center gap-2 px-2 py-1 text-xs border-b border-border/30">
                <span className="font-english font-semibold whitespace-nowrap">{p.phrase}</span>
                <span className="text-muted-foreground/70">—</span>
                <span className="flex-1 text-muted-foreground">{p.meaning_ko}</span>
                {onDeletePhrase && (
                  <button
                    onClick={() => onDeletePhrase(i)}
                    className="w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
