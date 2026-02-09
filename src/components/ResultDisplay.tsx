import { Chunk, segmentsToWords } from "@/lib/chunk-utils";

interface ResultDisplayProps {
  label: string;
  chunks?: Chunk[];
  text?: string;
  isKorean?: boolean;
}

export function ResultDisplay({ label, chunks, text, isKorean }: ResultDisplayProps) {
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </div>
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
                  ? segmentsToWords(chunk.segments).map((w, wi) => (
                      <span
                        key={wi}
                        className={w.isVerb ? "underline decoration-foreground decoration-2 underline-offset-[3px]" : ""}
                      >
                        {wi > 0 ? " " : ""}{w.word}
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
  );
}
