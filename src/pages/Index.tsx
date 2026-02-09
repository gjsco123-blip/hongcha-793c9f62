import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChunkEditor } from "@/components/ChunkEditor";
import { ResultDisplay } from "@/components/ResultDisplay";
import { SyntaxNotesSection } from "@/components/SyntaxNotesSection";
import { SentencePreview } from "@/components/SentencePreview";
import { Chunk, parseTagged, chunksToTagged } from "@/lib/chunk-utils";
import { usePdfExport } from "@/hooks/usePdfExport";
import { toast } from "sonner";
import { FileDown, RotateCw } from "lucide-react";

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
  syntaxNotes?: string;
  generatingSyntax?: boolean;
}

const PRESETS: Preset[] = ["고1", "고2", "수능"];

function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?]["'"\u201C\u201D\u2018\u2019]?)\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
}

export default function Index() {
  const [passage, setPassage] = useState("");
  const [preset, setPreset] = useState<Preset>("수능");
  const [results, setResults] = useState<SentenceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pdfTitle, setPdfTitle] = useState("SYNTAX");
  const [pdfSubtitle, setPdfSubtitle] = useState("문장 해석 연습");
  const [editedSentences, setEditedSentences] = useState<string[]>([]);

  const autoSentences = useMemo(
    () => splitIntoSentences(passage),
    [passage]
  );

  // 자동 분리 결과가 바뀌면 편집 상태 초기화
  const [lastAutoKey, setLastAutoKey] = useState("");
  const autoKey = autoSentences.join("\0");
  if (autoKey !== lastAutoKey) {
    setLastAutoKey(autoKey);
    setEditedSentences(autoSentences);
  }

  const { exportToPdf } = usePdfExport();

  const handleAnalyze = async () => {
    const sentences = editedSentences.filter((s) => s.trim().length > 0);
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
          syntaxNotes: "",
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
          syntaxNotes: "",
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

  const handleGenerateSyntax = async (sentenceId: number, original: string, selectedText?: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingSyntax: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("grammar", {
        body: { sentence: original, selectedText },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults((prev) =>
        prev.map((r) =>
          r.id === sentenceId
            ? {
                ...r,
                syntaxNotes: selectedText
                  ? (r.syntaxNotes ? r.syntaxNotes + "\n" + data.syntaxNotes : data.syntaxNotes)
                  : data.syntaxNotes,
                generatingSyntax: false,
              }
            : r
        )
      );
    } catch (e: any) {
      toast.error(`구문분석 생성 실패: ${e.message}`);
      setResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, generatingSyntax: false } : r))
      );
    }
  };

  const handleReanalyze = async (sentenceId: number) => {
    const target = results.find((r) => r.id === sentenceId);
    if (!target) return;

    setResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, regenerating: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("engine", {
        body: { sentence: target.original, preset },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults((prev) =>
        prev.map((r) =>
          r.id === sentenceId
            ? {
                ...r,
                englishChunks: parseTagged(data.english_tagged),
                koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
                koreanNatural: data.korean_natural,
                englishTagged: data.english_tagged,
                koreanLiteralTagged: data.korean_literal_tagged,
                regenerating: false,
              }
            : r
        )
      );
      toast.success(`문장 ${sentenceId + 1} 재분석 완료`);
    } catch (e: any) {
      toast.error(`재분석 실패: ${e.message}`);
      setResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, regenerating: false } : r))
      );
    }
  };

  const handleExportPdf = async () => {
    await exportToPdf(results, pdfTitle, pdfSubtitle, "syntax-worksheet.pdf");
    toast.success("PDF가 저장되었습니다.");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - 간소화 */}
      <header className="bg-card border-b-2 border-foreground no-print">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="제목"
              className="text-xl font-bold tracking-wide bg-transparent outline-none border-none text-foreground placeholder:text-muted-foreground/50 w-full"
            />
            <input
              type="text"
              value={pdfSubtitle}
              onChange={(e) => setPdfSubtitle(e.target.value)}
              placeholder="부제목"
              className="text-xs text-muted-foreground bg-transparent outline-none border-none placeholder:text-muted-foreground/50 w-full"
            />
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
          <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {editedSentences.length}개 문장
              </span>
            </div>
            <div className="flex gap-2 items-center">
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
                disabled={loading || editedSentences.length === 0}
                className="px-5 py-2 bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {loading
                  ? `분석 중... (${progress.current}/${progress.total})`
                  : "분석하기"}
              </button>
            </div>
          </div>
        </div>

        {/* Sentence Preview */}
        {editedSentences.length > 0 && !loading && results.length === 0 && (
          <div className="mb-6">
            <SentencePreview
              sentences={editedSentences}
              onChange={setEditedSentences}
            />
          </div>
        )}

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
                  <p className="font-english text-base leading-relaxed text-foreground flex-1">
                    {result.original}
                  </p>
                  <button
                    onClick={() => handleReanalyze(result.id)}
                    disabled={result.regenerating}
                    title="이 문장 재분석"
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${result.regenerating ? 'animate-spin' : ''}`} />
                  </button>
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
                          ✏️ 편집 · 더블클릭으로 동사 표시 · " / "로 분할
                        </span>
                      </div>
                      <ChunkEditor
                        chunks={result.englishChunks}
                        onChange={(chunks) => handleChunkChange(result.id, chunks)}
                        disabled={result.regenerating}
                        onAnalyzeSelection={(text) => handleGenerateSyntax(result.id, result.original, text)}
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

                    {/* 구문분석 */}
                    <SyntaxNotesSection
                      value={result.syntaxNotes ?? ""}
                      onChange={(val) =>
                        setResults((prev) =>
                          prev.map((r) =>
                            r.id === result.id ? { ...r, syntaxNotes: val } : r
                          )
                        )
                      }
                      generating={result.generatingSyntax}
                      onGenerate={() => handleGenerateSyntax(result.id, result.original)}
                    />
                  </div>
                ) : (
                  <div className="ml-9 text-xs text-destructive">분석 실패</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
