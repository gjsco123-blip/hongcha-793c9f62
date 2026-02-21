import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import type { VocabItem, SectionStatus } from "./types";

// PDF에서 meaning이 2줄로 넘어가는지 추정 (Korean char ~6.5pt, available width ~60pt → ~9 chars)
const PDF_MEANING_MAX_CHARS = 9;

interface Props {
  vocab: VocabItem[];
  status: SectionStatus;
  onDelete: (index: number) => void;
  onEdit: (index: number, field: keyof VocabItem, value: string) => void;
}

export function PreviewVocabSection({ vocab, status, onDelete, onEdit }: Props) {
  if (status === "idle") return null;

  const LoadingDot = () => <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground inline-block" />;

  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 flex items-center gap-2">
        Vocabulary ({vocab.length})
        {status === "loading" && <LoadingDot />}
      </h2>
      {status === "error" && <p className="text-xs text-destructive">어휘 생성에 실패했습니다.</p>}
      {vocab.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          {Array.from({ length: Math.ceil(vocab.length / 10) }, (_, colIdx) =>
            vocab.slice(colIdx * 10, colIdx * 10 + 10)
          ).map((col, colIdx) => (
            <div key={colIdx} className="border border-border/60 divide-y divide-border/40">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <span className="w-4 text-center">#</span>
                <span className="min-w-[55px]">Word</span>
                <span className="w-7 text-center">POS</span>
                <span className="flex-1">Meaning</span>
                <span className="w-5" />
              </div>
              {col.map((v, i) => {
                const globalIdx = colIdx * 10 + i;
                const num = globalIdx + 1;
                const isOverflow = v.meaning_ko.length > PDF_MEANING_MAX_CHARS;
                return (
                  <div key={num} className="group flex items-center gap-2 px-2 py-1.5 text-xs">
                    <span className="w-4 text-center text-muted-foreground/50 text-[10px]">{num}</span>
                    <span className="font-english font-semibold min-w-[55px] whitespace-nowrap">{v.word}</span>
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
      )}
    </section>
  );
}
