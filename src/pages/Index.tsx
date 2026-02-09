import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChunkEditor } from "@/components/ChunkEditor";
import { ResultDisplay } from "@/components/ResultDisplay";
import { PrintableWorksheet } from "@/components/PrintableWorksheet";
import { Chunk, parseTagged, chunksToTagged } from "@/lib/chunk-utils";
import { usePdfExport } from "@/hooks/usePdfExport";
import { toast } from "sonner";
import { FileDown } from "lucide-react";

type Preset = "고1" | "고2" | "수능";

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  englishTagged: string;
  koreanLiteralTagged: string;
  regenerating?: boolean;
}

const PRESETS: Preset[] = ["고1", "고2", "수능"];

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function Index() {
  const [passage, setPassage] = useState("");
  const [preset, setPreset] = useState<Preset>("수능");
  const [results, setResults] = useState<SentenceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [showPreview, setShowPreview] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const { exportToPdf } = usePdfExport(printRef);

  const handleAnalyze = async () => {
    const sentences = splitIntoSentences(passage);
    if (sentences.length === 0) return;

    setLoading(true);
    setResults([]);
    setProgress({ current: 0, total: sentences.length });

    const newResults: SentenceResult[] = [];

    for (let i = 0; i < sentences.length; i++) {
      setProgress({ current: i + 1, total: sentences.length });

      try {
        const { data, error } = await supabase.functions.invoke("engine", {
          body: { sentence: sentences[i], preset },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        newResults.push({
          id: i,
          original: sentences[i],
          englishChunks: parseTagged(data.english_tagged),
          koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
          koreanNatural: data.korean_natural,
          englishTagged: data.english_tagged,
          koreanLiteralTagged: data.korean_literal_tagged,
        });

        setResults([...newResults]);
      } catch (e: any) {
        toast.error(`문장 ${i + 1} 분석 실패: ${e.message}`);
        newResults.push({
          id: i,
          original: sentences[i],
          englishChunks: [],
          koreanLiteralChunks: [],
          koreanNatural: "분석 실패",
          englishTagged: "",
          koreanLiteralTagged: "",
        });
        setResults([...newResults]);
      }
    }

    setLoading(false);
  };

  const handleChunkChange = async (sentenceId: number, newChunks: Chunk[]) => {
    const newTagged = chunksToTagged(newChunks);

    setResults((prev) =>
      prev.map((r) =>
        r.id === sentenceId
          ? { ...r, englishChunks: newChunks, englishTagged: newTagged, regenerating: true }
          : r
      )
    );

    try {
      const { data, error } = await supabase.functions.invoke("regenerate", {
        body: { english_tagged: newTagged },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults((prev) =>
        prev.map((r) =>
          r.id === sentenceId
            ? {
                ...r,
                koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
                koreanLiteralTagged: data.korean_literal_tagged,
                regenerating: false,
              }
            : r
        )
      );
    } catch (e: any) {
      toast.error(`재생성 실패: ${e.message}`);
      setResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, regenerating: false } : r))
      );
    }
  };

  const handleExportPdf = async () => {
    setShowPreview(true);
    setTimeout(async () => {
      await exportToPdf("syntax-worksheet.pdf");
      toast.success("PDF가 저장되었습니다.");
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-foreground no-print">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center gap-5">
            {/* Unit badge */}
            <div className="bg-foreground text-background px-4 py-3 text-center">
              <div className="text-[10px] tracking-widest font-medium">UNIT</div>
              <div className="text-2xl font-bold leading-none mt-0.5">01</div>
            </div>
            {/* Title */}
            <div>
              <h1 className="text-xl font-bold tracking-wide">SYNTAX</h1>
              <p className="text-xs text-muted-foreground mt-0.5">문장 해석 연습</p>
            </div>
            {/* Spacer */}
            <div className="flex-1" />
            {/* Preset buttons */}
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border
                    ${
                      preset === p
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-foreground border-border hover:border-foreground"
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-6 no-print">
        {/* Input Section */}
        <div className="mb-6">
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            placeholder="영어 지문을 입력하세요..."
            rows={5}
            className="w-full bg-card border border-border px-4 py-3 text-sm font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {splitIntoSentences(passage).length}개 문장
            </span>
            <div className="flex gap-2">
              {results.length > 0 && (
                <button
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF 저장
                </button>
              )}
              <button
                onClick={handleAnalyze}
                disabled={loading || splitIntoSentences(passage).length === 0}
                className="px-5 py-2 bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading
                  ? `분석 중... (${progress.current}/${progress.total})`
                  : "분석하기"}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-0 border-t-2 border-foreground">
            {results.map((result, index) => (
              <div
                key={result.id}
                className="border-b border-border py-5 animate-fade-in"
              >
                {/* Sentence with number */}
                <div className="flex gap-3 mb-4">
                  <span className="text-sm font-semibold shrink-0 w-6">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="font-english text-base leading-relaxed text-foreground">
                    {result.original}
                  </p>
                </div>

                {result.englishChunks.length > 0 ? (
                  <div className="ml-9 space-y-4">
                    {/* English chunks */}
                    <div className="bg-muted/50 border border-border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Chunking
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          더블클릭으로 편집 · " / "로 분할
                        </span>
                      </div>
                      <ChunkEditor
                        chunks={result.englishChunks}
                        onChange={(chunks) => handleChunkChange(result.id, chunks)}
                        disabled={result.regenerating}
                      />
                    </div>

                    {/* Korean literal */}
                    <div className="bg-muted/50 border border-border p-3 relative">
                      {result.regenerating && (
                        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-10">
                          <span className="text-xs text-muted-foreground animate-pulse">
                            재생성 중...
                          </span>
                        </div>
                      )}
                      <ResultDisplay
                        label="직역"
                        chunks={result.koreanLiteralChunks}
                        isKorean
                      />
                    </div>

                    {/* Korean natural */}
                    <div className="bg-muted/50 border border-border p-3">
                      <ResultDisplay
                        label="의역"
                        text={result.koreanNatural}
                        isKorean
                      />
                    </div>
                  </div>
                ) : (
                  <div className="ml-9 text-xs text-destructive">분석 실패</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Hidden printable worksheet */}
      {showPreview && (
        <div className="fixed left-[-9999px] top-0">
          <PrintableWorksheet ref={printRef} results={results} />
        </div>
      )}
    </div>
  );
}
