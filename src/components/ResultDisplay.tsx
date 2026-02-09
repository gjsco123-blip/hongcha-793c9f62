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
    backgroundColor: `hsl(${hsl} / 0.1)`,
    borderColor: `hsl(${hsl} / 0.2)`,
  };
}

interface ResultDisplayProps {
  label: string;
  chunks?: Chunk[];
  text?: string;
  isKorean?: boolean;
}

export function ResultDisplay({ label, chunks, text, isKorean }: ResultDisplayProps) {
  return (
    <div className="space-y-2 animate-fade-in">
      <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {chunks ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chunks.map((chunk, i) => (
            <div key={`${chunk.tag}-${i}`} className="flex items-center gap-1">
              <span
                style={getChunkStyle(i)}
                className={`inline-block px-2.5 py-1 rounded-md text-sm border ${isKorean ? "font-korean" : "font-mono"}`}
              >
                {chunk.text}
              </span>
              {i < chunks.length - 1 && (
                <span className="text-muted-foreground/40 text-sm">/</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-base leading-relaxed ${isKorean ? "font-korean" : "font-mono"} text-foreground`}>
          {text}
        </p>
      )}
    </div>
  );
}
