import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChunkEditor } from "@/components/ChunkEditor";
import { ResultDisplay } from "@/components/ResultDisplay";
import { Chunk, parseTagged, chunksToTagged, chunksToSlash } from "@/lib/chunk-utils";
import { toast } from "sonner";

type Preset = "고1" | "고2" | "수능";

interface AnalysisResult {
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  englishTagged: string;
  koreanLiteralTagged: string;
}

const PRESETS: Preset[] = ["고1", "고2", "수능"];

export default function Index() {
  const [sentence, setSentence] = useState("");
  const [preset, setPreset] = useState<Preset>("수능");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleAnalyze = async () => {
    if (!sentence.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("engine", {
        body: { sentence: sentence.trim(), preset },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult({
        englishChunks: parseTagged(data.english_tagged),
        koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
        koreanNatural: data.korean_natural,
        englishTagged: data.english_tagged,
        koreanLiteralTagged: data.korean_literal_tagged,
      });
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChunkChange = async (newChunks: Chunk[]) => {
    if (!result) return;
    const newTagged = chunksToTagged(newChunks);
    setResult((prev) => prev ? { ...prev, englishChunks: newChunks, englishTagged: newTagged } : null);

    // Auto-regenerate Korean literal
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("regenerate", {
        body: { english_tagged: newTagged },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult((prev) =>
        prev
          ? {
              ...prev,
              koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
              koreanLiteralTagged: data.korean_literal_tagged,
            }
          : null
      );
    } catch (e: any) {
      toast.error(e.message || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Sentence Engine
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              English chunking → Korean translation
            </p>
          </div>
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-korean font-medium transition-colors
                  ${preset === p
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
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Input */}
          <div className="space-y-3">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              English Sentence
            </label>
            <div className="flex gap-2">
              <input
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="Enter an English sentence..."
                className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
              />
              <button
                onClick={handleAnalyze}
                disabled={loading || !sentence.trim()}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading ? "..." : "Analyze"}
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-6 border border-border rounded-xl p-6 bg-card">
              {/* English chunks (editable) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    English Chunks
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    Double-click to edit · Use " / " to split
                  </span>
                </div>
                <ChunkEditor
                  chunks={result.englishChunks}
                  onChange={handleChunkChange}
                  disabled={regenerating}
                />
              </div>

              <div className="border-t border-border" />

              {/* Korean literal */}
              <div className="relative">
                {regenerating && (
                  <div className="absolute inset-0 bg-card/60 flex items-center justify-center rounded z-10">
                    <span className="text-xs text-muted-foreground animate-pulse">Regenerating...</span>
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
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3">
        <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
          Deterministic chunking engine · v1.0
        </p>
      </footer>
    </div>
  );
}
