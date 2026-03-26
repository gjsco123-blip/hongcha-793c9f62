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
import { useTeacherLabel } from "@/hooks/useTeacherLabel";
import { useCategories } from "@/hooks/useCategories";
import { renderWithSuperscripts, reorderNotesByPosition } from "@/lib/syntax-superscript";
import { paginateResults } from "@/lib/pdf-pagination";
import { mergePassageStore, parsePassageStore } from "@/lib/passage-store";
import { toast } from "sonner";
import { FileDown, RotateCw, X, Scissors, RefreshCw, Eye, Loader2, Settings2, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
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
  anchorMode?: "heuristic" | "selection-start";
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
  const [syntaxCompleted, setSyntaxCompleted] = useState(false);
  const [previewCompleted, setPreviewCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pdfTitle, setPdfTitle] = useState("SYNTAX");
  
  const [editedSentences, setEditedSentences] = useState<string[]>([]);
  const [batchHongTProgress, setBatchHongTProgress] = useState<{ current: number; total: number } | null>(null);

  const categories = useCategories();
  const { teacherLabel, setTeacherLabel } = useTeacherLabel();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dataLoadedRef = useRef(false);
  
  // Track AI-generated drafts for learning_examples auto-save
  const aiDraftMapRef = useRef<Record<number, string>>({});

  // Save syntax learning examples when leaving a passage
  const saveSyntaxLearningExamples = useCallback(async (resultsToSave: SentenceResult[]) => {
    if (!user?.id) return;
    const drafts = aiDraftMapRef.current;
    for (const r of resultsToSave) {
      if (!r.syntaxNotes || r.syntaxNotes.length === 0) continue;
      const finalVersion = r.syntaxNotes.map(n => n.content).join("\n");
      const aiDraft = drafts[r.id] || "";
      if (!finalVersion.trim()) continue;

      try {
        // Dedup: skip if same sentence saved within 24h
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase
          .from("learning_examples")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "syntax")
          .eq("sentence", r.original)
          .gte("created_at", since)
          .limit(1);
        if (existing && existing.length > 0) continue;

        await supabase.from("learning_examples").insert({
          user_id: user.id,
          type: "syntax",
          sentence: r.original,
          ai_draft: aiDraft,
          final_version: finalVersion,
          preset,
        });
      } catch {}
    }
  }, [user?.id, preset]);

  // Load passage data when a passage is selected
  const prevPassageIdRef = useRef<string | null>(null);
  const prevResultsRef = useRef<SentenceResult[]>([]);

  useEffect(() => {
    // Save learning examples from previous passage before loading new one
    if (prevPassageIdRef.current && prevPassageIdRef.current !== categories.selectedPassageId) {
      saveSyntaxLearningExamples(prevResultsRef.current);
      aiDraftMapRef.current = {};
    }
    prevPassageIdRef.current = categories.selectedPassageId || null;

    const p = categories.selectedPassage;
    if (p) {
      const store = parsePassageStore(p.results_json);
      setPassage(p.passage_text || "");
      setPdfTitle(p.pdf_title || p.name || "SYNTAX");
      setPreset((p.preset as Preset) || "수능");
      setSyntaxCompleted(!!store.completion?.syntaxCompleted);
      setPreviewCompleted(!!store.completion?.previewCompleted);
      if (store.syntaxResults && Array.isArray(store.syntaxResults)) {
        const loaded = (store.syntaxResults as any[]).map((r: any) => ({
          ...r,
          englishChunks: r.englishChunks || [],
          koreanLiteralChunks: r.koreanLiteralChunks || [],
          syntaxNotes: r.syntaxNotes || [],
          // Force-reset transient UI flags (may have been saved by older versions)
          generatingSyntax: false,
          generatingHongT: false,
          regenerating: false,
        }));
        setResults(loaded);
      } else {
        setResults([]);
      }
      dataLoadedRef.current = true;
    } else {
      setPreviewCompleted(false);
    }
  }, [categories.selectedPassageId, categories.selectedPassage]);

  // Keep prevResultsRef in sync
  useEffect(() => {
    prevResultsRef.current = results;
  }, [results]);

  // Auto-save with debounce
  const autoSave = useCallback(() => {
    if (!categories.selectedPassageId || !dataLoadedRef.current) return;
    const hasTransientWork = results.some((r) => r.generatingSyntax || r.generatingHongT || r.regenerating);
    if (hasTransientWork) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const stillHasTransientWork = results.some((r) => r.generatingSyntax || r.generatingHongT || r.regenerating);
      if (stillHasTransientWork) return;
      // Strip transient UI flags before persisting
      const sanitizedResults = results.map(({ generatingSyntax, generatingHongT, regenerating, ...rest }) => rest);
      const mergedStore = mergePassageStore(categories.selectedPassage?.results_json, {
        syntaxResults: sanitizedResults.length > 0 ? sanitizedResults : [],
        completion: { syntaxCompleted },
      });
      categories.updatePassage(categories.selectedPassageId!, {
        passage_text: passage,
        pdf_title: pdfTitle,
        preset,
        results_json: mergedStore,
      });
    }, 2000);
  }, [categories.selectedPassageId, categories.selectedPassage?.results_json, passage, pdfTitle, preset, results, syntaxCompleted]);

  useEffect(() => {
    autoSave();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [autoSave]);

  useEffect(() => {
    if (!categories.selectedPassageId) return;
    let cancelled = false;
    const syncPreviewCompletion = async () => {
      const { data } = await supabase
        .from("passages")
        .select("results_json")
        .eq("id", categories.selectedPassageId!)
        .single();
      if (cancelled || !data) return;
      const store = parsePassageStore(data.results_json);
      setPreviewCompleted(!!store.completion?.previewCompleted);
    };
    syncPreviewCompletion();
    return () => {
      cancelled = true;
    };
  }, [categories.selectedPassageId]);

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

  const { exportToPdf, previewPdf, exportCombinedPdf } = usePdfExport();
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [combinedPdfGenerating, setCombinedPdfGenerating] = useState(false);
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

  const generateAllHongT = async () => {
    const allSentences = results.map((r) => r.original);
    const targets = results.filter((r) => !r.hongTNotes?.trim() && !r.hideHongT);
    if (targets.length === 0) {
      toast.info("모든 문장에 홍T 해설이 이미 있습니다.");
      return;
    }

    setBatchHongTProgress({ current: 0, total: targets.length });
    let successCount = 0;

    for (let i = 0; i < targets.length; i++) {
      setBatchHongTProgress({ current: i + 1, total: targets.length });
      try {
        await generateHongT(targets[i].id, allSentences);
        successCount++;
      } catch (e) {
        console.error(`홍T 일괄 생성 실패 (문장 ${targets[i].id + 1}):`, e);
      }
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setBatchHongTProgress(null);
    if (successCount === targets.length) {
      toast.success(`홍T 생성 완료: ${successCount}/${targets.length} 성공`);
    } else {
      toast.warning(`홍T 생성 완료: ${successCount}/${targets.length} 성공`);
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
            const noteEntry: SyntaxNote = { id: slotNumber, content: data.syntaxNotes, targetText: selectedText, anchorMode: selectedText ? "selection-start" : "heuristic" };
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
            // Track AI draft for learning_examples
            aiDraftMapRef.current[sentenceId] = newNotes.map(n => n.content).join("\n");
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
      await exportToPdf(results, pdfTitle, "", `${pdfTitle}+구문분석.pdf`, teacherLabel);
      toast.success("PDF 다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error(`PDF 저장 실패: ${err.message}`);
    }
  };

  const handlePreviewPdf = async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const url = await previewPdf(results, pdfTitle, "", teacherLabel);
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

  const handleExportCombinedPdf = async () => {
    if (!categories.selectedPassageId || combinedPdfGenerating) return;
    setCombinedPdfGenerating(true);
    try {
      const { data, error } = await supabase
        .from("passages")
        .select("results_json")
        .eq("id", categories.selectedPassageId)
        .single();
      if (error) throw error;

      const store = parsePassageStore(data?.results_json);
      const syntaxDone = !!store.completion?.syntaxCompleted || syntaxCompleted;
      const previewDone = !!store.completion?.previewCompleted;
      if (!syntaxDone || !previewDone) {
        throw new Error("구문분석/Preview 완료 토글을 모두 켜주세요.");
      }

      const preview = store.preview;
      if (!preview) {
        throw new Error("Preview 저장 데이터가 없습니다. Preview 화면에서 완료 표시를 먼저 눌러주세요.");
      }

      await exportCombinedPdf(
        {
          vocab: Array.isArray(preview.vocab) ? (preview.vocab as any[]) : [],
          synonyms: Array.isArray(preview.synonyms) ? (preview.synonyms as any[]) : [],
          summary: typeof preview.summary === "string" ? preview.summary : "",
          examBlock: (preview.examBlock as any) || null,
          title: typeof preview.pdfTitle === "string" && preview.pdfTitle.trim() ? preview.pdfTitle : pdfTitle,
        },
        results,
        pdfTitle,
        "",
        `${pdfTitle}+통합.pdf`,
        teacherLabel
      );
      setPreviewCompleted(true);
      toast.success("통합 PDF 다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error(`통합 PDF 저장 실패: ${err.message}`);
    } finally {
      setCombinedPdfGenerating(false);
    }
  };

  const handleToggleSyntaxCompleted = async () => {
    if (!categories.selectedPassageId) return;
    const next = !syntaxCompleted;
    setSyntaxCompleted(next);
    const mergedStore = mergePassageStore(categories.selectedPassage?.results_json, {
      syntaxResults: results.length > 0 ? results : [],
      completion: {
        syntaxCompleted: next,
        syntaxCompletedAt: next ? new Date().toISOString() : null,
      },
    });
    categories.updatePassage(categories.selectedPassageId, {
      passage_text: passage,
      pdf_title: pdfTitle,
      preset,
      results_json: mergedStore,
    });
    toast.success(next ? "구문분석 완료로 표시됨" : "구문분석 완료 표시 해제");
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
    onRenamePassage: categories.renamePassage,
    onDeleteSchool: categories.deleteSchool,
    onDeletePassage: categories.deletePassage,
    onReorderPassages: categories.reorderPassages,
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
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={pdfTitle}
              onChange={(e) => setPdfTitle(e.target.value)}
              placeholder="제목"
              className="text-xl font-bold tracking-wide bg-transparent outline-none border-none text-foreground placeholder:text-muted-foreground/50 flex-1"
            />
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="설정">
                  <Settings2 className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  해설 선생님 이름
                </label>
                <input
                  type="text"
                  value={teacherLabel}
                  onChange={(e) => setTeacherLabel(e.target.value)}
                  placeholder="홍T"
                  className="mt-1.5 w-full bg-muted border border-border px-2.5 py-1.5 text-sm outline-none focus:border-foreground transition-colors"
                />
              </PopoverContent>
            </Popover>
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
                    className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                  >
                    {pdfGenerating ? "생성 중..." : "PDF 미리보기"}
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors"
                  >
                    PDF 저장
                  </button>
                  {syntaxCompleted && previewCompleted && (
                    <button
                      onClick={handleExportCombinedPdf}
                      disabled={combinedPdfGenerating}
                      className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                    >
                      {combinedPdfGenerating ? "통합 중..." : "통합 PDF 저장"}
                    </button>
                  )}
                </>
              )}
              {failedResults.length > 0 && !loading && (
                <button
                  onClick={handleRetryFailed}
                  className="px-3 py-1 rounded-full border border-destructive text-destructive text-[11px] font-medium hover:bg-destructive hover:text-destructive-foreground transition-colors"
                >
                  실패 {failedResults.length}건 재시도
                </button>
              )}
              <button
                onClick={() => navigate("/preview", { state: { passage, pdfTitle, passageId: categories.selectedPassageId } })}
                disabled={!passage.trim()}
                className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
              >
                Preview
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">완료</span>
                <Switch
                  checked={syntaxCompleted}
                  onCheckedChange={handleToggleSyntaxCompleted}
                  disabled={!categories.selectedPassageId}
                  className="scale-75"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || editedSentences.length === 0}
                className="px-4 py-1.5 rounded-full bg-foreground text-background text-[11px] font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
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
                      <div className="bg-muted/50 border border-border rounded-xl p-3 relative group/literal">
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
                        <button
                          onClick={async () => {
                            setResults(prev => prev.map(r => r.id === result.id ? { ...r, regeneratingLiteral: true } as any : r));
                            try {
                              const { data, error } = await supabase.functions.invoke("regenerate", {
                                body: { english_tagged: result.englishTagged },
                              });
                              if (error || data?.error) throw new Error(data?.error || error?.message);
                              const newTagged = data.korean_literal_tagged;
                              const newChunks = parseTagged(newTagged);
                              const oldText = result.koreanLiteralChunks.map(c => c.text).join(" / ");
                              const newText = newChunks.map(c => c.text).join(" / ");
                              if (oldText === newText) {
                                toast.info("동일한 결과입니다.");
                                setResults(prev => prev.map(r => r.id === result.id ? { ...r, regeneratingLiteral: false } as any : r));
                                return;
                              }
                              setResults(prev => prev.map(r => r.id === result.id ? { ...r, pendingLiteralChunks: newChunks, pendingLiteralTagged: newTagged, regeneratingLiteral: false } as any : r));
                            } catch (e: any) {
                              toast.error(`직역 재생성 실패: ${e.message}`);
                              setResults(prev => prev.map(r => r.id === result.id ? { ...r, regeneratingLiteral: false } as any : r));
                            }
                          }}
                          disabled={(result as any).regeneratingLiteral}
                          className="absolute top-1.5 right-7 p-0.5 text-muted-foreground/50 hover:text-foreground opacity-0 group-hover/literal:opacity-100 transition-opacity disabled:opacity-40"
                          title="직역 재생성"
                        >
                          <RefreshCw className={`w-3 h-3 ${(result as any).regeneratingLiteral ? "animate-spin" : ""}`} />
                        </button>
                        {(result as any).pendingLiteralChunks ? (
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-0.5 h-4 bg-foreground shrink-0 mt-[3px]" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 pt-[3px]">직역</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 ml-6">
                              <div>
                                <p className="text-[9px] text-muted-foreground mb-1 uppercase">기존</p>
                                <p className="text-xs font-sans opacity-60">{result.koreanLiteralChunks.map(c => c.text).join(" / ")}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-muted-foreground mb-1 uppercase">새 결과</p>
                                <p className="text-xs font-sans">{(result as any).pendingLiteralChunks.map((c: any) => c.text).join(" / ")}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, pendingLiteralChunks: undefined, pendingLiteralTagged: undefined } as any : r))}
                                className="text-[10px] px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                              >유지</button>
                              <button
                                onClick={() => setResults(prev => prev.map(r => r.id === result.id ? {
                                  ...r,
                                  koreanLiteralChunks: (r as any).pendingLiteralChunks,
                                  koreanLiteralTagged: (r as any).pendingLiteralTagged,
                                  pendingLiteralChunks: undefined,
                                  pendingLiteralTagged: undefined,
                                } as any : r))}
                                className="text-[10px] px-3 py-1 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
                              >적용</button>
                            </div>
                          </div>
                        ) : (
                          <ResultDisplay
                            label="직역"
                            chunks={result.koreanLiteralChunks}
                            isKorean
                            onChunkTextChange={(idx, newText) => {
                              setResults(prev => prev.map(r => {
                                if (r.id !== result.id) return r;
                                const updated = [...r.koreanLiteralChunks];
                                updated[idx] = { ...updated[idx], text: newText };
                                return { ...r, koreanLiteralChunks: updated };
                              }));
                            }}
                          />
                        )}
                      </div>
                    )}
                    {result.hideLiteral && (
                      <button
                        onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, hideLiteral: false } : r))}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors py-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>직역 보기</span>
                      </button>
                    )}

                    {/* Korean natural */}
                    {!result.hideNatural && (
                      <div className="bg-muted/50 border border-border rounded-xl p-3 relative group/natural">
                        <button
                          onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, hideNatural: true } : r))}
                          className="absolute top-1.5 right-1.5 p-0.5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/natural:opacity-100 transition-opacity"
                          title="의역 삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          onClick={async () => {
                            setResults(prev => prev.map(r => r.id === result.id ? { ...r, regeneratingNatural: true } as any : r));
                            try {
                              const { data, error } = await supabase.functions.invoke("engine", {
                                body: { sentence: result.original, preset },
                              });
                              if (error || data?.error) throw new Error(data?.error || error?.message);
                              const newNatural = data.korean_natural;
                              if (newNatural === result.koreanNatural) {
                                toast.info("동일한 결과입니다.");
                                setResults(prev => prev.map(r => r.id === result.id ? { ...r, regeneratingNatural: false } as any : r));
                                return;
                              }
                              setResults(prev => prev.map(r => r.id === result.id ? { ...r, pendingNatural: newNatural, regeneratingNatural: false } as any : r));
                            } catch (e: any) {
                              toast.error(`의역 재생성 실패: ${e.message}`);
                              setResults(prev => prev.map(r => r.id === result.id ? { ...r, regeneratingNatural: false } as any : r));
                            }
                          }}
                          disabled={(result as any).regeneratingNatural}
                          className="absolute top-1.5 right-7 p-0.5 text-muted-foreground/50 hover:text-foreground opacity-0 group-hover/natural:opacity-100 transition-opacity disabled:opacity-40"
                          title="의역 재생성"
                        >
                          <RefreshCw className={`w-3 h-3 ${(result as any).regeneratingNatural ? "animate-spin" : ""}`} />
                        </button>
                        {(result as any).pendingNatural ? (
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="w-0.5 h-4 bg-foreground shrink-0 mt-[3px]" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 pt-[3px]">의역</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 ml-6">
                              <div>
                                <p className="text-[9px] text-muted-foreground mb-1 uppercase">기존</p>
                                <p className="text-xs font-sans opacity-60">{result.koreanNatural}</p>
                              </div>
                              <div>
                                <p className="text-[9px] text-muted-foreground mb-1 uppercase">새 결과</p>
                                <p className="text-xs font-sans">{(result as any).pendingNatural}</p>
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, pendingNatural: undefined } as any : r))}
                                className="text-[10px] px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                              >유지</button>
                              <button
                                onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, koreanNatural: (r as any).pendingNatural, pendingNatural: undefined } as any : r))}
                                className="text-[10px] px-3 py-1 rounded-full bg-foreground text-background hover:opacity-90 transition-opacity"
                              >적용</button>
                            </div>
                          </div>
                        ) : (
                          <ResultDisplay
                            label="의역"
                            text={result.koreanNatural}
                            isKorean
                            onTextChange={(newText) => {
                              setResults(prev => prev.map(r => r.id === result.id ? { ...r, koreanNatural: newText } : r));
                            }}
                          />
                        )}
                      </div>
                    )}
                    {result.hideNatural && (
                      <button
                        onClick={() => setResults(prev => prev.map(r => r.id === result.id ? { ...r, hideNatural: false } : r))}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors py-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>의역 보기</span>
                      </button>
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
                        teacherLabel={teacherLabel}
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
              <div className={`flex items-center gap-2 py-3 px-2 mt-2 rounded-xl border border-dashed ${pageBreakInfo.totalPages <= 2 ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : 'border-destructive/50 bg-destructive/5'}`}>
                <span className={`text-xs font-medium ${pageBreakInfo.totalPages <= 2 ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>
                  예상 PDF: {pageBreakInfo.totalPages}페이지 {pageBreakInfo.totalPages <= 2 ? '' : '— 2페이지 초과'}
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
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
