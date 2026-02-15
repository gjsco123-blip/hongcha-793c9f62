import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChunkEditor } from "@/components/ChunkEditor";
import { ResultDisplay } from "@/components/ResultDisplay";
import { SyntaxNotesSection } from "@/components/SyntaxNotesSection";
import { HongTSection } from "@/components/HongTSection";
import { SentencePreview } from "@/components/SentencePreview";
import { Chunk, parseTagged, chunksToTagged } from "@/lib/chunk-utils";
import { usePdfExport } from "@/hooks/usePdfExport";
import { toast } from "sonner";
import { FileDown, RotateCw, X, Scissors } from "lucide-react";

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
  hongTNotes?: string;
  generatingHongT?: boolean;
  hideLiteral?: boolean;
  hideNatural?: boolean;
  hideHongT?: boolean;
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

  // PDF 페이지 구분선 계산 (A4: 842pt, 상42 하85 = 사용가능 715pt)
  const pageBreakInfo = useMemo(() => {
    if (results.length === 0) return { page1EndIndex: -1, totalPages: 0, passageFits: false };

    const PAGE_USABLE = [665, 715]; // page1 has header ~50pt
    const SENTENCE_BASE = 30;
    const CHUNK_ROW = 14;
    const TRANS_ROW = 12;
    const HONG_T_ROW = 14;
    const SYNTAX_ROW = 14;
    const CONTAINER_GAP = 20;
    const PASSAGE_SECTION = 60;

    let currentPage = 0;
    let usedHeight = 0;
    let page1EndIndex = -1;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      let h = SENTENCE_BASE + CHUNK_ROW;
      if (!r.hideLiteral) h += TRANS_ROW;
      if (!r.hideNatural) h += TRANS_ROW;
      if (r.hongTNotes) h += HONG_T_ROW;
      if (r.syntaxNotes) h += SYNTAX_ROW;
      h += CONTAINER_GAP;

      if (usedHeight + h > (PAGE_USABLE[currentPage] ?? 715)) {
        if (currentPage === 0) page1EndIndex = i - 1;
        currentPage++;
        usedHeight = h;
      } else {
        usedHeight += h;
      }
    }

    if (page1EndIndex === -1 && currentPage === 0) page1EndIndex = results.length - 1;

    const remaining = (PAGE_USABLE[currentPage] ?? 715) - usedHeight;
    const passageFits = currentPage <= 1 && remaining >= PASSAGE_SECTION;
    const totalPages = currentPage + 1 + (passageFits ? 0 : 1);

    return { page1EndIndex, totalPages, passageFits };
  }, [results]);


  const generateHongT = async (sentenceId: number, allSentences: string[]) => {
    setResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingHongT: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("hongt", {
        body: { sentences: allSentences, index: sentenceId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults((prev) =>
        prev.map((r) =>
          r.id === sentenceId
            ? { ...r, hongTNotes: data.explanation, generatingHongT: false }
            : r
        )
      );
    } catch (e: any) {
      console.error(`홍T 생성 실패 (문장 ${sentenceId + 1}):`, e.message);
      setResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, generatingHongT: false } : r))
      );
    }
  };

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
          hongTNotes: "",
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
          hongTNotes: "",
        });
        setResults([...newResults]);
      }
    }

    // Auto-generate 홍T for all sentences
    const allSentences = newResults.map((r) => r.original);
    for (let i = 0; i < newResults.length; i++) {
      if (newResults[i].englishChunks.length === 0) continue;
      generateHongT(i, allSentences);
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

  const handleGenerateSyntax = async (sentenceId: number, original: string, selectedText?: string, userHint?: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingSyntax: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("grammar", {
        body: { sentence: original, selectedText, userHint },
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
              <div key={result.id}>
                {/* 페이지 구분선 */}
                {index > 0 && index === pageBreakInfo.page1EndIndex + 1 && (
                  <div className="flex items-center gap-2 py-2 my-1">
                    <div className="flex-1 border-t-2 border-dashed border-destructive/50" />
                    <span className="text-[10px] font-medium text-destructive/70 shrink-0">
                      ✂️ PDF 페이지 1 끝 — 여기서 페이지 넘어감
                    </span>
                    <div className="flex-1 border-t-2 border-dashed border-destructive/50" />
                  </div>
                )}
                <div className="border-b border-border py-5 animate-fade-in">
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
                          ✏️ 편집 · 클릭: 분할/병합 · 더블클릭: 동사 표시
                        </span>
                      </div>
                      <ChunkEditor
                        chunks={result.englishChunks}
                        onChange={(chunks) => handleChunkChange(result.id, chunks)}
                        disabled={result.regenerating}
                        onAnalyzeSelection={(text, hint) => handleGenerateSyntax(result.id, result.original, text, hint)}
                      />
                    </div>

                    {/* Korean literal */}
                    {!result.hideLiteral && (
                      <div className="bg-muted/50 border border-border p-3 relative group/literal">
                        {result.regenerating && (
                          <div className="absolute inset-0 bg-muted/80 flex items-center justify-center z-10">
                            <span className="text-xs text-muted-foreground animate-pulse">
                              재생성 중...
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, hideLiteral: true } : r))}
                          className="absolute top-1.5 right-1.5 p-0.5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/literal:opacity-100 transition-opacity"
                          title="직역 삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <ResultDisplay
                          label="직역"
                          chunks={result.koreanLiteralChunks}
                          isKorean
                        />
                      </div>
                    )}

                    {/* Korean natural */}
                    {!result.hideNatural && (
                      <div className="bg-muted/50 border border-border p-3 relative group/natural">
                        <button
                          onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, hideNatural: true } : r))}
                          className="absolute top-1.5 right-1.5 p-0.5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/natural:opacity-100 transition-opacity"
                          title="의역 삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <ResultDisplay
                          label="의역"
                          text={result.koreanNatural}
                          isKorean
                        />
                      </div>
                    )}

                    {/* 홍T */}
                    {!result.hideHongT && (
                      <HongTSection
                        value={result.hongTNotes ?? ""}
                        onChange={(val) =>
                          setResults((prev) =>
                            prev.map((r) =>
                              r.id === result.id ? { ...r, hongTNotes: val } : r
                            )
                          )
                        }
                        generating={result.generatingHongT}
                        onGenerate={() => {
                          const allSentences = results.map((r) => r.original);
                          generateHongT(result.id, allSentences);
                        }}
                        onDelete={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, hideHongT: true } : r))}
                      />
                    )}

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
              </div>
            ))}
            {/* 페이지 상태 표시 */}
            {pageBreakInfo.totalPages > 0 && (
              <div className={`flex items-center gap-2 py-3 px-2 mt-2 border border-dashed ${pageBreakInfo.totalPages <= 2 ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-destructive/50 bg-destructive/5'}`}>
                <span className={`text-xs font-medium ${pageBreakInfo.totalPages <= 2 ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                  📄 예상 PDF: {pageBreakInfo.totalPages}페이지 {pageBreakInfo.totalPages <= 2 ? '✅' : '⚠️ 2페이지 초과'}
                  {' · '}Original Passage: {pageBreakInfo.passageFits ? '2페이지 안에 포함 ✅' : '별도 페이지 ⚠️'}
                </span>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
