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

function chunksToText(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join(" ");
}

export const PrintableWorksheet = forwardRef<HTMLDivElement, PrintableWorksheetProps>(
  ({ results, title = "SYNTAX" }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white p-10"
        style={{ 
          width: "210mm", 
          minHeight: "297mm", 
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: "11pt",
          lineHeight: "1.8"
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 border-b-2 border-black pb-4">
          <div className="bg-black text-white px-4 py-3 text-center">
            <div style={{ fontSize: "9pt", letterSpacing: "0.1em" }}>UNIT</div>
            <div style={{ fontSize: "20pt", fontWeight: "bold", lineHeight: 1 }}>01</div>
          </div>
          <div>
            <h1 style={{ fontSize: "16pt", fontWeight: "bold", letterSpacing: "0.05em" }}>{title}</h1>
            <p style={{ fontSize: "9pt", color: "#666" }}>문장 해석 연습</p>
          </div>
          <div className="flex-1" />
          <div style={{ fontSize: "9pt", color: "#666", textAlign: "right" }}>
            <div>이름: _______________</div>
            <div className="mt-1">날짜: _______________</div>
          </div>
        </div>

        {/* Sentences */}
        <div className="space-y-6">
          {results.map((result, index) => (
            <div key={result.id} className="border-b border-gray-300 pb-5">
              {/* English sentence */}
              <div className="flex gap-3 mb-3">
                <span 
                  className="inline-flex items-center justify-center shrink-0"
                  style={{ 
                    width: "20px", 
                    height: "20px", 
                    borderRadius: "50%", 
                    border: "1px solid black",
                    fontSize: "9pt",
                    fontWeight: 500
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p style={{ fontFamily: "'Noto Serif', Georgia, serif", fontSize: "11pt" }}>
                  {result.original}
                </p>
              </div>

              {result.englishChunks.length > 0 && (
                <div className="ml-8 space-y-2">
                  {/* 직역 - plain text */}
                  <p style={{ fontSize: "11pt", color: "#333" }}>
                    {chunksToText(result.koreanLiteralChunks)}
                  </p>

                  {/* 의역 - plain text */}
                  <p style={{ fontSize: "11pt", color: "#333" }}>
                    {result.koreanNatural}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="mt-10 grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-4">
            <div className="border border-gray-400 p-4" style={{ minHeight: "80px" }}>
              <div style={{ fontSize: "10pt", marginBottom: "8px" }}>
                <span style={{ fontWeight: 500 }}>Before</span>
                <span style={{ color: "#666", marginLeft: "8px" }}>| 수업 전 스스로 해석 해보기</span>
              </div>
              <div style={{ height: "40px", borderBottom: "1px dashed #ccc" }} />
            </div>
            <div className="border border-gray-400 p-4" style={{ minHeight: "80px" }}>
              <div style={{ fontSize: "10pt", marginBottom: "8px" }}>
                <span style={{ fontWeight: 500 }}>After</span>
                <span style={{ color: "#666", marginLeft: "8px" }}>| 수업 후 해석해보고 비교하기</span>
              </div>
              <div style={{ height: "40px", borderBottom: "1px dashed #ccc" }} />
            </div>
          </div>
          <div className="border-2 border-black p-4" style={{ minHeight: "172px" }}>
            <div style={{ fontSize: "10pt", fontWeight: 500, marginBottom: "8px" }}>MEMO</div>
            <div className="space-y-3">
              <div style={{ height: "16px", borderBottom: "1px dashed #ccc" }} />
              <div style={{ height: "16px", borderBottom: "1px dashed #ccc" }} />
              <div style={{ height: "16px", borderBottom: "1px dashed #ccc" }} />
              <div style={{ height: "16px", borderBottom: "1px dashed #ccc" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PrintableWorksheet.displayName = "PrintableWorksheet";
