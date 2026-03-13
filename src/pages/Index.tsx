import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChunkEditor } from "@/components/ChunkEditor";
import { ResultDisplay } from "@/components/ResultDisplay";
import { SyntaxNotesSection } from "@/components/SyntaxNotesSection";
import { HongTSection } from "@/components/HongTSection";
import { SentencePreview } from "@/components/SentencePreview";
import { CategoryHeaderBar, CategoryFullScreen } from "@/components/CategorySelector";
import { Chunk, parseTagged, chunksToTagged } from "@/lib/chunk-utils";
import { usePdfExport } from "@/hooks/usePdfExport";
import { useCategories } from "@/hooks/useCategories";
import { renderWithSuperscripts, reorderNotesByPosition } from "@/lib/syntax-superscript";
import { paginateResults } from "@/lib/pdf-pagination";
import { toast } from "sonner";
import { FileDown, RotateCw, X, Scissors, RefreshCw, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
type Preset = "고1" | "고2" | "수능";

async function invokeWithRetry(
  sentence: string,
  preset: string,
  maxRetries = 3
): Promise<{ data: any; error: any }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke("engine", {
      body: { sentence, preset },
    });

    if (!error && data && !data.error) return { data, error: null };

    const isRetryable =
      error?.status === 429 ||
      error?.status === 503 ||
      (typeof data?.error === "string" && /rate.?limit/i.test(data.error));

    if (isRetryable && attempt < maxRetries) {
      const waitMs = Math.pow(2, attempt) * 500 + Math.random() * 500;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    return { data, error };
  }
  return { data: null, error: new Error("Max retries exceeded") };
}

export interface SyntaxNote {
  id: number; // 1~5
  content: string;
  targetText?: string; // 드래그한 원문 텍스트
}

interface SentenceResult {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  englishTagged: string;
  koreanLiteralTagged: string;
  regenerating?: boolean;
  syntaxNotes: SyntaxNote[];
  generatingSyntax?: boolean;
  hongTNotes?: string;
  generatingHongT?: boolean;
  hideLiteral?: boolean;
  hideNatural?: boolean;
  hideHongT?: boolean;
}

const PRESETS: Preset[] = ["고1", "고2", "수능"];

function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace,
  // but NOT after single-letter abbreviations like "U.S." or "Dr." etc.
  // Negative lookbehind: don't split after a single uppercase letter + dot (e.g. U.S.)
  const raw = text.split(/(?<=[.!?]["'"\u201C\u201D\u2018\u2019]?)\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  
  // Merge fragments that were incorrectly split at abbreviations (e.g. "U.S.")
  const merged: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const frag = raw[i];
    // If previous fragment ends with an abbreviation pattern (single letter + dot, or known abbrevs)
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      // Ends with single uppercase letter + "." or common abbreviations
      const abbrPattern = /(?:\b[A-Z]\.|(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Corp|Ltd|Co|U\.S|U\.K|U\.N|e\.g|i\.e)\.)$/;
      if (abbrPattern.test(prev)) {
        merged[merged.length - 1] = prev + " " + frag;
        continue;
      }
    }
    merged.push(frag);
  }
  return merged;
}

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [passage, setPassage] = useState("");
  const [preset, setPreset] = useState<Preset>("수능");
  const [results, setResults] = useState<SentenceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pdfTitle, setPdfTitle] = useState("SYNTAX");
  
  const [editedSentences, setEditedSentences] = useState<string[]>([]);

  const categories = useCategories();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dataLoadedRef = useRef(false);

  // Load passage data when a passage is selected
  useEffect(() => {
    const p = categories.selectedPassage;
    if (p) {
      setPassage(p.passage_text || "");
      setPdfTitle(p.pdf_title || p.name || "SYNTAX");
      setPreset((p.preset as Preset) || "수능");
      if (p.results_json && Array.isArray(p.results_json)) {
        const loaded = (p.results_json as any[]).map((r: any) => ({
          ...r,
          englishChunks: r.englishChunks || [],
          koreanLiteralChunks: r.koreanLiteralChunks || [],
          syntaxNotes: r.syntaxNotes || [],
        }));
        setResults(loaded);
      } else {
        setResults([]);
      }
      dataLoadedRef.current = true;
    }
  }, [categories.selectedPassageId, categories.selectedPassage]);

  // Auto-save with debounce
  const autoSave = useCallback(() => {
    if (!categories.selectedPassageId || !dataLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      categories.updatePassage(categories.selectedPassageId!, {
        passage_text: passage,
        pdf_title: pdfTitle,
        preset,
        results_json: results.length > 0 ? results : null,
      });
    }, 2000);
  }, [categories.selectedPassageId, passage, pdfTitle, preset, results]);

  useEffect(() => {
    autoSave();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [autoSave]);

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

  const { exportToPdf, previewPdf } = usePdfExport();
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // PDF 페이지 구분선 계산 — 공용 페이지네이션 로직 사용 (PDF와 100% 동일)
  const pageBreakInfo = useMemo(() => {
    const result = paginateResults(results);
    return {
      page1EndIndex: result.page1EndIndex,
      totalPages: result.totalPages,
    };
  }, [results]);


  const generateHongT = async (sentenceId: number, allSentences: string[]) => {
    setResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingHongT: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("hongt", {
        body: { sentences: allSentences, index: sentenceId, userId: user?.id },
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

    const CONCURRENCY = 3;
    for (let batch = 0; batch < sentences.length; batch += CONCURRENCY) {
      const chunk = sentences.slice(batch, batch + CONCURRENCY);
      const promises = chunk.map((s, j) =>
        invokeWithRetry(s, preset)
          .then(({ data, error }) => ({ idx: batch + j, sentence: s, data, error }))
          .catch((e: any) => ({ idx: batch + j, sentence: s, data: null, error: e }))
      );

      const batchResults = await Promise.all(promises);

      for (const { idx, sentence, data, error } of batchResults) {
        if (error || !data || data.error) {
          const msg = error?.message || data?.error || "알 수 없는 오류";
          toast.error(`문장 ${idx + 1} 분석 실패: ${msg}`);
          newResults.push({
            id: idx, original: sentence,
            englishChunks: [], koreanLiteralChunks: [],
            koreanNatural: "분석 실패", englishTagged: "", koreanLiteralTagged: "",
            syntaxNotes: [], hongTNotes: "",
          });
        } else {
          newResults.push({
            id: idx, original: sentence,
            englishChunks: parseTagged(data.english_tagged),
            koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
            koreanNatural: data.korean_natural,
            englishTagged: data.english_tagged,
            koreanLiteralTagged: data.korean_literal_tagged,
            syntaxNotes: [], hongTNotes: "",
          });
        }
      }

      setProgress({ current: Math.min(batch + CONCURRENCY, sentences.length), total: sentences.length });
      setResults([...newResults]);
    }

    // 홍T는 사용자가 버튼 클릭 시에만 생성

    setLoading(false);
  };

  const failedResults = useMemo(
    () => results.filter((r) => r.koreanNatural === "분석 실패"),
    [results]
  );

  const handleRetryFailed = async () => {
    if (loading || failedResults.length === 0) return;
    setLoading(true);
    setProgress({ current: 0, total: failedResults.length });

    const CONCURRENCY = 3;
    let done = 0;
    for (let batch = 0; batch < failedResults.length; batch += CONCURRENCY) {
      const chunk = failedResults.slice(batch, batch + CONCURRENCY);
      const promises = chunk.map((r) =>
        invokeWithRetry(r.original, preset)
          .then(({ data, error }) => ({ id: r.id, original: r.original, data, error }))
          .catch((e: any) => ({ id: r.id, original: r.original, data: null, error: e }))
      );
      const batchResults = await Promise.all(promises);

      for (const { id, original, data, error } of batchResults) {
        if (!error && data && !data.error) {
          setResults((prev) =>
            prev.map((r) =>
              r.id === id
                ? {
                    ...r,
                    englishChunks: parseTagged(data.english_tagged),
                    koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
                    koreanNatural: data.korean_natural,
                    englishTagged: data.english_tagged,
                    koreanLiteralTagged: data.korean_literal_tagged,
                  }
                : r
            )
          );
        } else {
          const msg = error?.message || data?.error || "알 수 없는 오류";
          toast.error(`문장 ${id + 1} 재시도 실패: ${msg}`);
        }
      }
      done += chunk.length;
      setProgress({ current: done, total: failedResults.length });
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

  const handleGenerateSyntax = async (sentenceId: number, original: string, selectedText?: string, userHint?: string, slotNumber?: number) => {
    setResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingSyntax: true } : r))
    );

    try {
      const isAuto = !selectedText && !userHint;
      const { data, error } = await supabase.functions.invoke("grammar", {
        body: { sentence: original, selectedText, userHint, mode: isAuto ? "auto" : undefined, userId: user?.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResults((prev) =>
        prev.map((r) => {
          if (r.id !== sentenceId) return r;

          let newNotes = [...(r.syntaxNotes || [])];

          if (slotNumber) {
            // 특정 번호 슬롯에 저장
            const existingIdx = newNotes.findIndex((n) => n.id === slotNumber);
            const noteEntry: SyntaxNote = { id: slotNumber, content: data.syntaxNotes, targetText: selectedText };
            if (existingIdx >= 0) {
              newNotes[existingIdx] = noteEntry;
            } else {
              newNotes.push(noteEntry);
            }
            // 문장 내 등장 순서로 자동 정렬
            newNotes = reorderNotesByPosition(newNotes, original);
          } else {
            // 자동 생성: 전체 교체 (autoPoints가 있으면 targetText 포함)
            if (Array.isArray(data.autoPoints) && data.autoPoints.length > 0) {
              // 같은 targetText를 가진 연속 포인트를 하나의 번호로 병합
              const rawPoints = data.autoPoints.map((p: any) => ({
                text: String(p.text || "").replace(/^[•·\-]\s*/, ""),
                targetText: String(p.targetText || "") || undefined,
              }));
              const merged: { content: string; targetText?: string }[] = [];
              for (const pt of rawPoints) {
                const prev = merged.length > 0 ? merged[merged.length - 1] : null;
                if (prev && prev.targetText && pt.targetText && prev.targetText === pt.targetText) {
                  prev.content += "\n" + pt.text;
                } else {
                  merged.push({ content: pt.text, targetText: pt.targetText });
                }
              }
              newNotes = merged.map((m, idx) => ({
                id: idx + 1,
                content: m.content,
                targetText: m.targetText,
              }));
            } else {
              const lines = (data.syntaxNotes as string).split("\n").filter((l: string) => l.trim());
              newNotes = lines.map((line: string, idx: number) => ({
                id: idx + 1,
                content: line.replace(/^[•·\-]\s*/, ""),
              }));
            }
            // 자동 생성도 안전하게 정렬
            newNotes = reorderNotesByPosition(newNotes, original);
          }

          return { ...r, syntaxNotes: newNotes, generatingSyntax: false };
        })
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
    try {
      await exportToPdf(results, pdfTitle, "", "syntax-worksheet.pdf");
      toast.success("PDF 다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error(`PDF 저장 실패: ${err.message}`);
    }
  };

  const handlePreviewPdf = async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const url = await previewPdf(results, pdfTitle, "");
      // Convert blob URL to data URL for sandbox compatibility
      const resp = await fetch(url);
      const blob = await resp.blob();
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onloadend = () => setPdfBlobUrl(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (err: any) {
      toast.error(`PDF 미리보기 실패: ${err.message}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  const closePdfPreview = () => {
    setPdfBlobUrl(null);
  };

  const categoryProps = {
    schools: categories.schools,
    passages: categories.passages,
    selectedSchoolId: categories.selectedSchoolId,
    selectedPassageId: categories.selectedPassageId,
    onSelectSchool: categories.setSelectedSchoolId,
    onSelectPassage: categories.setSelectedPassageId,
    onAddSchool: categories.addSchool,
    onAddPassage: categories.addPassage,
    onDeleteSchool: categories.deleteSchool,
    onDeletePassage: categories.deletePassage,
    onClearPassage: () => categories.setSelectedPassageId(""),
  };

  // Show full-screen selection when no passage is selected
  if (!categories.selectedPassageId) {
    return <CategoryFullScreen {...categoryProps} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border no-print">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <CategoryHeaderBar {...categoryProps} />
          <div className="mt-3">
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="제목"
              className="text-xl font-bold tracking-wide bg-transparent outline-none border-none text-foreground placeholder:text-muted-foreground/50 w-full"
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
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-english leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground transition-colors resize-y"
          />
          <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {editedSentences.length}개 문장
              </span>
            </div>
            <div className="flex gap-2 items-center">
              {results.length > 0 && (
                <>
                  <button
                    onClick={handlePreviewPdf}
                    disabled={pdfGenerating}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                  >
                    {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    PDF 미리보기
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF 저장
                  </button>
                </>
              )}
              {failedResults.length > 0 && !loading && (
                <button
                  onClick={handleRetryFailed}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-destructive text-destructive text-xs font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  실패 {failedResults.length}건 재시도
                </button>
              )}
              <button
                onClick={() => navigate("/preview", { state: { passage, pdfTitle } })}
                disabled={!passage.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={handleAnalyze}
                disabled={loading || editedSentences.length === 0}
                className="px-5 py-2 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
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
          <div className="space-y-0 border-t border-border">
            {results.map((result, index) => (
              <div key={result.id}>
                {/* 페이지 구분선 */}
                {index > 0 && index === pageBreakInfo.page1EndIndex + 1 && (
                  <div className="flex items-center gap-2 py-2 my-1">
                    <div className="flex-1 border-t-2 border-dashed border-destructive/50" />
                    <span className="text-[10px] font-medium text-destructive/70 shrink-0">
                      PDF 페이지 1 끝 — 여기서 페이지 넘어감
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
                  <p className="font-sans font-semibold text-base leading-relaxed text-foreground flex-1">
                    {renderWithSuperscripts(result.original, result.syntaxNotes || [])}
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
                    <div className="bg-muted/50 border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Chunking
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          편집 · 클릭: 분할/병합 · 더블클릭: 동사 표시
                        </span>
                      </div>
                      <ChunkEditor
                        chunks={result.englishChunks}
                        onChange={(chunks) => handleChunkChange(result.id, chunks)}
                        disabled={result.regenerating}
                        onAnalyzeSelection={(text, hint, slotNumber) => handleGenerateSyntax(result.id, result.original, text, hint, slotNumber)}
                        usedSlots={(result.syntaxNotes || []).map(n => n.id)}
                        syntaxNotes={result.syntaxNotes || []}
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
                        sentence={result.original}
                        fullPassage={results.map((r) => r.original).join(" ")}
                        preset={preset}
                      />
                    )}

                    {/* 구문분석 */}
                    <SyntaxNotesSection
                      notes={result.syntaxNotes || []}
                      onChange={(notes) =>
                        setResults((prev) =>
                          prev.map((r) =>
                            r.id === result.id ? { ...r, syntaxNotes: notes } : r
                          )
                        )
                      }
                      generating={result.generatingSyntax}
                      onGenerate={() => handleGenerateSyntax(result.id, result.original)}
                      sentence={result.original}
                      fullPassage={results.map((r) => r.original).join(" ")}
                      preset={preset}
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
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={!!pdfBlobUrl} onOpenChange={(open) => { if (!open) closePdfPreview(); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <span className="text-sm font-medium">PDF 미리보기</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" /> 다운로드
              </button>
              <button onClick={closePdfPreview} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {pdfBlobUrl && (
            <iframe src={pdfBlobUrl} className="w-full flex-1" style={{ height: "calc(90vh - 48px)" }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
