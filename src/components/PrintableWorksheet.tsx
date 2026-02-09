import { forwardRef } from "react";
import { Chunk } from "@/lib/chunk-utils";

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
}

interface PrintableWorksheetProps {
  results: SentenceResult[];
  title?: string;
}

export const PrintableWorksheet = forwardRef<HTMLDivElement, PrintableWorksheetProps>(
  ({ results, title = "SYNTAX" }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white p-8 text-foreground"
        style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 border-b-2 border-foreground pb-4">
          <div className="bg-foreground text-white px-4 py-3 text-center">
            <div className="text-[10px] tracking-widest font-medium">UNIT</div>
            <div className="text-2xl font-bold leading-none">01</div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">{title}</h1>
            <p className="text-xs text-muted-foreground">문장 해석 연습</p>
          </div>
          <div className="flex-1" />
          <div className="text-right text-xs text-muted-foreground">
            <div>이름: _______________</div>
            <div className="mt-1">날짜: _______________</div>
          </div>
        </div>

        {/* Sentences */}
        <div className="space-y-6">
          {results.map((result, index) => (
            <div key={result.id} className="border-b border-border pb-4">
              {/* Sentence with number */}
              <div className="flex gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-foreground text-xs font-medium shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="font-english text-sm leading-relaxed font-medium">
                  {result.original}
                </p>
              </div>

              {result.englishChunks.length > 0 && (
                <div className="ml-9 space-y-3">
                  {/* Chunking */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Chunking
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {result.englishChunks.map((chunk, i) => (
                        <span key={`en-${i}`} className="inline-flex items-center">
                          <span
                            className="font-english text-xs px-1.5 py-0.5 border border-border bg-muted"
                          >
                            {chunk.text}
                          </span>
                          {i < result.englishChunks.length - 1 && (
                            <span className="text-muted-foreground text-xs mx-0.5">/</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Korean Literal */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      직역
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {result.koreanLiteralChunks.map((chunk, i) => (
                        <span key={`kr-${i}`} className="inline-flex items-center">
                          <span
                            className="text-xs px-1.5 py-0.5 border border-border bg-muted"
                          >
                            {chunk.text}
                          </span>
                          {i < result.koreanLiteralChunks.length - 1 && (
                            <span className="text-muted-foreground text-xs mx-0.5">/</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Korean Natural */}
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      의역
                    </div>
                    <p className="text-xs leading-relaxed pl-1">
                      {result.koreanNatural}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-3">
            <div className="border border-border p-3 min-h-[80px]">
              <div className="text-xs mb-2">
                <span className="font-medium">Before</span>
                <span className="text-muted-foreground ml-2">| 수업 전 스스로 해석 해보기</span>
              </div>
              <div className="h-12 border-b border-dashed border-border" />
            </div>
            <div className="border border-border p-3 min-h-[80px]">
              <div className="text-xs mb-2">
                <span className="font-medium">After</span>
                <span className="text-muted-foreground ml-2">| 수업 후 해석해보고 비교하기</span>
              </div>
              <div className="h-12 border-b border-dashed border-border" />
            </div>
          </div>
          <div className="border border-foreground p-3 min-h-[172px]">
            <div className="text-xs font-medium mb-2">MEMO</div>
            <div className="space-y-2">
              <div className="h-4 border-b border-dashed border-border" />
              <div className="h-4 border-b border-dashed border-border" />
              <div className="h-4 border-b border-dashed border-border" />
              <div className="h-4 border-b border-dashed border-border" />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableWorksheet.displayName = "PrintableWorksheet";
