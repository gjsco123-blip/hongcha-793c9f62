import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChunkEditor } from "@/components/ChunkEditor";
import { ResultDisplay } from "@/components/ResultDisplay";
import { Chunk, parseTagged, chunksToTagged } from "@/lib/chunk-utils";
import { toast } from "sonner";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b-2 border-primary">
        <div className="max-w-5xl mx-auto px-8 py-6">
          <div className="flex items-center gap-6">
            {/* Unit badge */}
            <div className="bg-primary text-primary-foreground px-5 py-4 rounded-sm">
              <div className="text-xs tracking-widest font-medium">UNIT</div>
              <div className="text-3xl font-bold leading-none mt-1">01</div>
            </div>
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-primary tracking-wide">
                SYNTAX
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                문장 해석 연습
              </p>
            </div>
            {/* Spacer */}
            <div className="flex-1" />
            {/* Preset buttons */}
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors border
                    ${
                      preset === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="border-t border-border" />

      {/* Main */}
      <main className="max-w-5xl mx-auto px-8 py-8">
        {/* Input Section */}
        <div className="mb-8">
          <textarea
            value={passage}
            onChange={(e) => setPassage(e.target.value)}
            placeholder="영어 지문을 입력하세요..."
            rows={6}
            className="w-full bg-card border border-border rounded-sm px-5 py-4 text-base font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">
              {splitIntoSentences(passage).length}개 문장
            </span>
            <button
              onClick={handleAnalyze}
              disabled={loading || splitIntoSentences(passage).length === 0}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {loading
                ? `분석 중... (${progress.current}/${progress.total})`
                : "분석하기"}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-0 border-t-2 border-primary">
            {results.map((result, index) => (
              <div
                key={result.id}
                className="border-b border-border py-6 animate-fade-in"
              >
                {/* Sentence with number */}
                <div className="flex gap-4 mb-5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground text-sm font-medium shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="font-english text-lg leading-relaxed text-foreground">
                    {result.original}
                  </p>
                </div>

                {result.englishChunks.length > 0 ? (
                  <div className="ml-12 space-y-5">
                    {/* English chunks */}
                    <div className="bg-muted/50 rounded-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-accent uppercase tracking-wide">
                          Chunking
                        </span>
                        <span className="text-[10px] text-muted-foreground">
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
                    <div className="bg-muted/50 rounded-sm p-4 relative">
                      {result.regenerating && (
                        <div className="absolute inset-0 bg-muted/80 flex items-center justify-center rounded-sm z-10">
                          <span className="text-sm text-muted-foreground animate-pulse">
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
                    <div className="bg-muted/50 rounded-sm p-4">
                      <ResultDisplay
                        label="의역"
                        text={result.koreanNatural}
                        isKorean
                      />
                    </div>
                  </div>
                ) : (
                  <div className="ml-12 text-sm text-destructive">
                    분석 실패
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Before / After / Memo section */}
        {results.length > 0 && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">
              <div className="bg-muted rounded-sm p-4 min-h-[100px]">
                <div className="text-sm mb-2">
                  <span className="text-accent font-medium">Before</span>
                  <span className="text-muted-foreground ml-2">| 수업 전 스스로 해석 해보기</span>
                </div>
              </div>
              <div className="bg-muted rounded-sm p-4 min-h-[100px]">
                <div className="text-sm mb-2">
                  <span className="text-accent font-medium">After</span>
                  <span className="text-muted-foreground ml-2">| 수업 후 해석해보고 비교하기</span>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-sm p-4 min-h-[216px]">
              <div className="text-sm font-medium text-primary mb-2">MEMO</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
