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
import { FileDown, RotateCw, X, Scissors, RefreshCw, Eye, Loader2, Settings2, Sparkles, Merge } from "lucide-react";
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
  const [results, setResultsRaw] = useState<SentenceResult[]>([]);
  const resultsRef = useRef<SentenceResult[]>([]);
  const updateResults = useCallback((updater: React.SetStateAction<SentenceResult[]>) => {
    setResultsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      resultsRef.current = next;
      return next;
    });
  }, []);
  const [syntaxCompleted, setSyntaxCompleted] = useState(false);
  const [previewCompleted, setPreviewCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pdfTitle, setPdfTitle] = useState("SYNTAX");
  
  const [editedSentences, setEditedSentences] = useState<string[]>([]);
  const [hongTPhase, setHongTPhase] = useState<{ current: number; total: number } | null>(null);
  const [resultEditingIndex, setResultEditingIndex] = useState<number | null>(null);
  const [resultEditValue, setResultEditValue] = useState("");
  const resultEditRef = useRef<HTMLTextAreaElement>(null);

  const categories = useCategories();
  const { teacherLabel, setTeacherLabel } = useTeacherLabel();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dataLoadedRef = useRef(false);
  const baseResultsJsonRef = useRef<unknown>(null); // last-known DB results_json for merge base
  const analysisPipelineActiveRef = useRef(false); // true during analyze/hongT pipeline
  const lastHydratedIdRef = useRef<string | null>(null); // prevent same-passage rehydrate
  
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
  

  useEffect(() => {
    const id = categories.selectedPassageId;
    const p = categories.selectedPassage;

    // Save learning examples from previous passage before loading new one
    if (prevPassageIdRef.current && prevPassageIdRef.current !== id) {
      saveSyntaxLearningExamples(resultsRef.current);
      aiDraftMapRef.current = {};
    }
    prevPassageIdRef.current = id || null;

    // Only hydrate when passage ID actually changes AND data is available
    // This prevents same-passage rehydrate after auto-save overwrites local state
    if (id && p && id !== lastHydratedIdRef.current) {
      lastHydratedIdRef.current = id;
      dataLoadedRef.current = false;

      const store = parsePassageStore(p.results_json);
      baseResultsJsonRef.current = p.results_json;
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
          generatingSyntax: false,
          generatingHongT: false,
          regenerating: false,
        }));
        updateResults(loaded);
      } else {
        updateResults([]);
      }
      dataLoadedRef.current = true;
    } else if (!id) {
      lastHydratedIdRef.current = null;
      setPreviewCompleted(false);
    }
  }, [categories.selectedPassageId, categories.selectedPassage]);


  // Auto-save with debounce
  // Refs for auto-save timeout to always read latest values (prevent stale closure)
  const passageRef = useRef(passage);
  passageRef.current = passage;
  const pdfTitleRef = useRef(pdfTitle);
  pdfTitleRef.current = pdfTitle;
  const presetRef = useRef(preset);
  presetRef.current = preset;
  const syntaxCompletedRef = useRef(syntaxCompleted);
  syntaxCompletedRef.current = syntaxCompleted;

  const autoSave = useCallback(() => {
    if (!categories.selectedPassageId || !dataLoadedRef.current) return;
    // Block auto-save entirely during analysis/hongT pipeline
    if (analysisPipelineActiveRef.current) return;
    const hasTransientWork = resultsRef.current.some((r) => r.generatingSyntax || r.generatingHongT || r.regenerating);
    if (hasTransientWork) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      // Re-check inside timeout using refs (not stale closure)
      if (analysisPipelineActiveRef.current) return;
      const latestResults = resultsRef.current;
      const stillHasTransientWork = latestResults.some((r) => r.generatingSyntax || r.generatingHongT || r.regenerating);
      if (stillHasTransientWork) return;
      // Strip transient UI flags before persisting
      const sanitizedResults = latestResults.map(({ generatingSyntax, generatingHongT, regenerating, ...rest }) => rest);
      const mergedStore = mergePassageStore(baseResultsJsonRef.current, {
        syntaxResults: sanitizedResults.length > 0 ? sanitizedResults : [],
        completion: { syntaxCompleted: syntaxCompletedRef.current },
      });
      const updated = await categories.updatePassage(categories.selectedPassageId!, {
        passage_text: passageRef.current,
        pdf_title: pdfTitleRef.current,
        preset: presetRef.current,
        results_json: mergedStore,
      });
      if (updated) {
        baseResultsJsonRef.current = updated.results_json;
      }
    }, 2000);
  }, [categories.selectedPassageId, passage, pdfTitle, preset, results, syntaxCompleted]);

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

  const { exportToPdf, previewPdf, exportCombinedPdf, exportWorkbookPdf } = usePdfExport();
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [combinedPdfGenerating, setCombinedPdfGenerating] = useState(false);
  const [workbookPdfGenerating, setWorkbookPdfGenerating] = useState(false);
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
    updateResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingHongT: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("hongt", {
        body: { sentences: allSentences, index: sentenceId, userId: user?.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      updateResults((prev) =>
        prev.map((r) =>
          r.id === sentenceId
            ? { ...r, hongTNotes: data.explanation, generatingHongT: false }
            : r
        )
      );
    } catch (e: any) {
      console.error(`홍T 생성 실패 (문장 ${sentenceId + 1}):`, e.message);
      updateResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, generatingHongT: false } : r))
      );
    }
  };


  const handleAnalyze = async () => {
    const sentences = editedSentences.filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return;

    // Activate pipeline guard — blocks auto-save & rehydration
    analysisPipelineActiveRef.current = true;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    setLoading(true);
    updateResults([]);
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
      updateResults([...newResults]);
    }

    // 구문분석 완료 후 홍T 순차 생성
    const allSentences = newResults.map((r) => r.original);
    const hongTTargets = newResults.filter((r) => !r.hongTNotes?.trim() && r.koreanNatural !== "분석 실패" && !r.hideHongT);

    if (hongTTargets.length > 0) {
      setHongTPhase({ current: 0, total: hongTTargets.length });
      for (let i = 0; i < hongTTargets.length; i++) {
        setHongTPhase({ current: i + 1, total: hongTTargets.length });
        try {
          await generateHongT(hongTTargets[i].id, allSentences);
        } catch (e) {
          console.error(`홍T 생성 실패 (문장 ${hongTTargets[i].id + 1}):`, e);
        }
        if (i < hongTTargets.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      setHongTPhase(null);
    }

    // 홍T 생성 완료 후 즉시 강제 저장 (debounce 우회)
    if (categories.selectedPassageId) {
      const latestResults = resultsRef.current;
      const sanitized = latestResults.map(({ generatingSyntax, generatingHongT, regenerating, ...rest }: any) => rest);
      const mergedStore = mergePassageStore(baseResultsJsonRef.current, {
        syntaxResults: sanitized.length > 0 ? sanitized : [],
        completion: { syntaxCompleted: true },
      });
      const updated = await categories.updatePassage(categories.selectedPassageId, {
        passage_text: passage,
        pdf_title: pdfTitle,
        preset,
        results_json: mergedStore,
      });
      if (updated) {
        baseResultsJsonRef.current = updated.results_json;
      }
    }

    // Deactivate pipeline guard — auto-save can resume
    analysisPipelineActiveRef.current = false;
    setLoading(false);
  };

  const failedResults = useMemo(
    () => results.filter((r) => r.koreanNatural === "분석 실패"),
    [results]
  );

  const handleRetryFailed = async () => {
    if (loading || failedResults.length === 0) return;
    analysisPipelineActiveRef.current = true;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
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
          updateResults((prev) =>
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
    analysisPipelineActiveRef.current = false;
    setLoading(false);
  };

  const handleChunkChange = async (sentenceId: number, newChunks: Chunk[]) => {
    const newTagged = chunksToTagged(newChunks);

    updateResults((prev) =>
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

      updateResults((prev) =>
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
      updateResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, regenerating: false } : r))
      );
    }
  };

  const handleGenerateSyntax = async (sentenceId: number, original: string, selectedText?: string, userHint?: string, slotNumber?: number) => {
    updateResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, generatingSyntax: true } : r))
    );

    try {
      const isAuto = !selectedText && !userHint;
      const { data, error } = await supabase.functions.invoke("grammar", {
        body: { sentence: original, selectedText, userHint, mode: isAuto ? "auto" : undefined, userId: user?.id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      updateResults((prev) =>
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
      updateResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, generatingSyntax: false } : r))
      );
    }
  };

  const handleReanalyze = async (sentenceId: number) => {
    const target = results.find((r) => r.id === sentenceId);
    if (!target) return;

    updateResults((prev) =>
      prev.map((r) => (r.id === sentenceId ? { ...r, regenerating: true } : r))
    );

    try {
      const { data, error } = await supabase.functions.invoke("engine", {
        body: { sentence: target.original, preset },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      updateResults((prev) =>
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
      updateResults((prev) =>
        prev.map((r) => (r.id === sentenceId ? { ...r, regenerating: false } : r))
      );
    }
  };

  // Re-analyze a single sentence text and return the result
  const reanalyzeSingle = async (sentence: string, id: number): Promise<SentenceResult> => {
    const { data, error } = await invokeWithRetry(sentence, preset);
    if (error || !data || data.error) {
      return {
        id, original: sentence,
        englishChunks: [], koreanLiteralChunks: [],
        koreanNatural: "분석 실패", englishTagged: "", koreanLiteralTagged: "",
        syntaxNotes: [], hongTNotes: "",
      };
    }
    return {
      id, original: sentence,
      englishChunks: parseTagged(data.english_tagged),
      koreanLiteralChunks: parseTagged(data.korean_literal_tagged),
      koreanNatural: data.korean_natural,
      englishTagged: data.english_tagged,
      koreanLiteralTagged: data.korean_literal_tagged,
      syntaxNotes: [], hongTNotes: "",
    };
  };

  const handleMergeResult = async (index: number) => {
    if (index >= results.length - 1 || loading) return;
    const merged = results[index].original + " " + results[index + 1].original;

    const newResults = results.filter((_, i) => i !== index + 1).map((r, i) => ({
      ...r,
      id: i,
      ...(i === index ? { original: merged, regenerating: true, englishChunks: [] as Chunk[], koreanLiteralChunks: [] as Chunk[], koreanNatural: "", syntaxNotes: [] as SyntaxNote[], hongTNotes: "" } : {}),
    }));
    updateResults(newResults);
    setResultEditingIndex(null);

    try {
      const reanalyzed = await reanalyzeSingle(merged, index);
      updateResults(prev => prev.map(r => r.id === index ? { ...reanalyzed, regenerating: false } : r));
      const allSentences = resultsRef.current.map(r => r.original);
      await generateHongT(index, allSentences);
      toast.success(`문장 ${index + 1}~${index + 2} 합치기 완료`);
    } catch (e: any) {
      toast.error(`합치기 재분석 실패: ${e.message}`);
      updateResults(prev => prev.map(r => r.id === index ? { ...r, regenerating: false } : r));
    }
  };

  const handleSplitResult = async (index: number) => {
    if (!resultEditRef.current) return;
    const pos = resultEditRef.current.selectionStart;
    const text = resultEditValue;
    if (pos <= 0 || pos >= text.length) return;

    const left = text.slice(0, pos).trim();
    const right = text.slice(pos).trim();
    if (!left || !right) return;

    const newResults: SentenceResult[] = [];
    for (let i = 0; i < results.length; i++) {
      if (i === index) {
        newResults.push({ ...results[i], id: newResults.length, original: left, regenerating: true, englishChunks: [], koreanLiteralChunks: [], koreanNatural: "", syntaxNotes: [], hongTNotes: "" });
        newResults.push({ ...results[i], id: newResults.length, original: right, regenerating: true, englishChunks: [], koreanLiteralChunks: [], koreanNatural: "", syntaxNotes: [], hongTNotes: "" });
      } else {
        newResults.push({ ...results[i], id: newResults.length });
      }
    }
    updateResults(newResults);
    setResultEditingIndex(null);

    try {
      const leftIdx = index;
      const rightIdx = index + 1;
      const [leftResult, rightResult] = await Promise.all([
        reanalyzeSingle(left, leftIdx),
        reanalyzeSingle(right, rightIdx),
      ]);
      updateResults(prev => prev.map(r => {
        if (r.id === leftIdx) return { ...leftResult, regenerating: false };
        if (r.id === rightIdx) return { ...rightResult, regenerating: false };
        return r;
      }));
      const allSentences = resultsRef.current.map(r => r.original);
      await generateHongT(leftIdx, allSentences);
      await generateHongT(rightIdx, allSentences);
      toast.success(`문장 ${index + 1} 나누기 완료`);
    } catch (e: any) {
      toast.error(`나누기 재분석 실패: ${e.message}`);
      updateResults(prev => prev.map(r => (r.id === index || r.id === index + 1) ? { ...r, regenerating: false } : r));
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
    const sanitizedResults = results.map(({ generatingSyntax, generatingHongT, regenerating, ...rest }) => rest);
    const mergedStore = mergePassageStore(baseResultsJsonRef.current, {
      syntaxResults: sanitizedResults.length > 0 ? sanitizedResults : [],
      completion: {
        syntaxCompleted: next,
        syntaxCompletedAt: next ? new Date().toISOString() : null,
      },
    });
    const updated = await categories.updatePassage(categories.selectedPassageId, {
      passage_text: passage,
      pdf_title: pdfTitle,
      preset,
      results_json: mergedStore,
    });
    if (updated) {
      baseResultsJsonRef.current = updated.results_json;
    }
    toast.success(next ? "구문분석 완료로 표시됨" : "구문분석 완료 표시 해제");
  };

  const handleExportWorkbookPdf = async () => {
    if (workbookPdfGenerating) return;
    setWorkbookPdfGenerating(true);
    try {
      const store = parsePassageStore(categories.selectedPassage?.results_json);
      const examBlock = (store.preview?.examBlock as any) || null;
      await exportWorkbookPdf(results, pdfTitle, examBlock, `${pdfTitle}+Workbook.pdf`);
      toast.success("워크북 PDF 다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error(`워크북 PDF 저장 실패: ${err.message}`);
    } finally {
      setWorkbookPdfGenerating(false);
    }
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
                  <button
                    onClick={handleExportWorkbookPdf}
                    disabled={workbookPdfGenerating}
                    className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                  >
                    {workbookPdfGenerating ? "생성 중..." : "워크북 저장"}
                  </button>
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
                  ? hongTPhase
                    ? `${teacherLabel} 생성 중... (${hongTPhase.current}/${hongTPhase.total})`
                    : `분석 중... (${progress.current}/${progress.total})`
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
              <React.Fragment key={result.id}>
              <div>
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
                  {resultEditingIndex === index ? (
                    <div className="flex-1 flex flex-col gap-1.5">
                      <textarea
                        ref={resultEditRef}
                        autoFocus
                        value={resultEditValue}
                        onChange={(e) => setResultEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setResultEditingIndex(null);
                        }}
                        rows={2}
                        className="w-full bg-background border border-foreground px-2 py-1.5 text-sm font-english text-foreground outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSplitResult(index)}
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          title="커서 위치에서 나누기"
                        >
                          <Scissors className="w-3 h-3" />
                          커서에서 나누기
                        </button>
                        <button
                          onClick={() => setResultEditingIndex(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          취소 (Esc)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      onDoubleClick={() => {
                        if (!result.regenerating) {
                          setResultEditingIndex(index);
                          setResultEditValue(result.original);
                        }
                      }}
                      className="font-sans font-semibold text-base leading-relaxed text-foreground flex-1 cursor-pointer hover:bg-muted/50 px-1 py-0.5 -mx-1 transition-colors"
                      title="더블클릭으로 나누기"
                    >
                      {renderWithSuperscripts(result.original, result.syntaxNotes || [])}
                    </p>
                  )}
                  <button
                    onClick={() => handleReanalyze(result.id)}
                    disabled={result.regenerating}
                    title="이 문장 재분석"
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${result.regenerating ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
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
