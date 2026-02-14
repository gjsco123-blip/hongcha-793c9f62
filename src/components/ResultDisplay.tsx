import { Chunk } from "@/lib/chunk-utils";

interface ResultDisplayProps {
  label: string;
  chunks?: Chunk[];
  text?: string;
  isKorean?: boolean;
}

export function ResultDisplay({ label, chunks, text, isKorean }: ResultDisplayProps) {
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
              <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1">
                <span
                  className={`inline-block px-2 py-1 text-xs border border-border bg-background ${
                    isKorean ? "font-sans" : "font-english"
                  }`}
                >
                  {!isKorean
                    ? chunk.segments.map((seg, si) => (
                        <span
                          key={si}
                          className={seg.isVerb ? "underline decoration-foreground decoration-2 underline-offset-[3px]" : ""}
                        >
                          {seg.text}
                        </span>
                      ))
                    : chunk.text}
                </span>
                {i < chunks.length - 1 && (
                  <span className="text-muted-foreground text-xs">/</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p
            className={`text-sm leading-relaxed ${
              isKorean ? "font-sans" : "font-english"
            } text-foreground`}
          >
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
