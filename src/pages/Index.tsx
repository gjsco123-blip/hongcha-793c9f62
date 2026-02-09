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

// Split passage into sentences
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Sentence Engine
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              영어 지문 → 문장별 청킹 + 한국어 번역
            </p>
          </div>
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-korean font-medium transition-colors
                  ${
                    preset === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Input */}
          <div className="space-y-3">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              English Passage
            </label>
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder="영어 지문을 입력하세요. 여러 문장도 가능합니다..."
              rows={5}
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-ring/30 transition-shadow resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-korean">
                {splitIntoSentences(passage).length}개 문장 감지됨
              </span>
              <button
                onClick={handleAnalyze}
                disabled={loading || splitIntoSentences(passage).length === 0}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading
                  ? `분석 중... (${progress.current}/${progress.total})`
                  : "전체 분석"}
              </button>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-6">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className="border border-border rounded-xl p-5 bg-card space-y-4 animate-fade-in"
                >
                  {/* Sentence number */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {index + 1}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                      {result.original}
                    </span>
                  </div>

                  {result.englishChunks.length > 0 ? (
                    <>
                      {/* English chunks (editable) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                            English Chunks
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 font-korean">
                            더블클릭으로 편집 · " / "로 분할
                          </span>
                        </div>
                        <ChunkEditor
                          chunks={result.englishChunks}
                          onChange={(chunks) => handleChunkChange(result.id, chunks)}
                          disabled={result.regenerating}
                        />
                      </div>

                      <div className="border-t border-border" />

                      {/* Korean literal */}
                      <div className="relative">
                        {result.regenerating && (
                          <div className="absolute inset-0 bg-card/60 flex items-center justify-center rounded z-10">
                            <span className="text-xs text-muted-foreground animate-pulse font-korean">
                              재생성 중...
                            </span>
                          </div>
                        )}
                        <ResultDisplay
                          label="Korean Literal (직역)"
                          chunks={result.koreanLiteralChunks}
                          isKorean
                        />
                      </div>

                      <div className="border-t border-border" />

                      {/* Korean natural */}
                      <ResultDisplay
                        label="Korean Natural (의역)"
                        text={result.koreanNatural}
                        isKorean
                      />
                    </>
                  ) : (
                    <p className="text-sm text-destructive font-korean">분석 실패</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3">
        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          Deterministic chunking engine · v1.1
        </p>
      </footer>
    </div>
  );
}
