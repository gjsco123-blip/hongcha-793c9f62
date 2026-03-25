import { useState, useEffect, createElement, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowLeft, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PreviewPdf } from "@/components/PreviewPdf";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PreviewPassageInput } from "@/components/preview/PreviewPassageInput";
import { PreviewVocabSection } from "@/components/preview/PreviewVocabSection";
import { PreviewSummarySection } from "@/components/preview/PreviewSummarySection";
import { PreviewSynonymsSection } from "@/components/preview/PreviewSynonymsSection";
import { PreviewExamSection } from "@/components/preview/PreviewExamSection";
import type { VocabItem, SynAntItem, ExamBlock, SectionStatus } from "@/components/preview/types";
import { mergePassageStore, parsePassageStore } from "@/lib/passage-store";
import { sanitizeSynonymItems } from "@/lib/synonym-sanitizer";

async function invokeRetry(fn: string, body: any, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (!error && data && !data.error) return data;
    const isRetryable =
      error?.status === 429 || error?.status === 503 ||
      (typeof data?.error === "string" && /rate.?limit/i.test(data.error));
    if (isRetryable && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500 + Math.random() * 500));
      continue;
    }
    throw new Error(error?.message || data?.error || "Unknown error");
  }
  throw new Error("Max retries exceeded");
}

const STORAGE_KEY = "preview-state";

function loadCached() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function Preview() {
  const navigate = useNavigate();
  const location = useLocation();
  const cached = loadCached();
  const incomingPassage = (location.state as any)?.passage;
  const passageId = (location.state as any)?.passageId || sessionStorage.getItem("selected-passage-id");
  const pdfTitle = (location.state as any)?.pdfTitle || cached?.pdfTitle || "Preview";

  // If navigated with a new passage, use it; otherwise restore cache
  const isNewPassage = !!incomingPassage && incomingPassage !== cached?.passage;
  const initialPassage = isNewPassage ? incomingPassage : (cached?.passage || incomingPassage || "");

  const [passage, setPassage] = useState(initialPassage);
  const [vocab, setVocab] = useState<VocabItem[]>(isNewPassage ? [] : (cached?.vocab || []));
  const [vocabStatus, setVocabStatus] = useState<SectionStatus>(isNewPassage ? "idle" : (cached?.vocab?.length ? "done" : "idle"));
  const [synonyms, setSynonyms] = useState<SynAntItem[]>(
    isNewPassage ? [] : sanitizeSynonymItems(cached?.synonyms || [], initialPassage)
  );
  const [synonymsStatus, setSynonymsStatus] = useState<SectionStatus>(isNewPassage ? "idle" : (cached?.synonyms?.length ? "done" : "idle"));
  const [summary, setSummary] = useState(isNewPassage ? "" : (cached?.summary || ""));
  const [examBlock, setExamBlock] = useState<ExamBlock | null>(isNewPassage ? null : (cached?.examBlock || null));
  const [previewStatus, setPreviewStatus] = useState<SectionStatus>(isNewPassage ? "idle" : (cached?.summary || cached?.examBlock ? "done" : "idle"));
  const [addingWord, setAddingWord] = useState<string | null>(null);
  const [enrichingIdx, setEnrichingIdx] = useState<number | null>(null);
  const [synonymSelectMode, setSynonymSelectMode] = useState(false);
  const [addingSynonymWord, setAddingSynonymWord] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [previewCompleted, setPreviewCompleted] = useState(false);
  const [loadingSavedState, setLoadingSavedState] = useState(false);
  const [baseResultsJson, setBaseResultsJson] = useState<unknown>(null);

  // Persist state to sessionStorage
  useEffect(() => {
    const state = { passage, vocab, synonyms, summary, examBlock, pdfTitle };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [passage, vocab, synonyms, summary, examBlock, pdfTitle]);

  useEffect(() => {
    if (!passageId) return;
    let cancelled = false;
    const loadSaved = async () => {
      setLoadingSavedState(true);
      const { data, error } = await supabase
        .from("passages")
        .select("results_json, passage_text, pdf_title, name")
        .eq("id", passageId)
        .single();
      setLoadingSavedState(false);
      if (cancelled || error || !data) return;

      setBaseResultsJson(data.results_json);
      const store = parsePassageStore(data.results_json);
      setPreviewCompleted(!!store.completion?.previewCompleted);

      if (store.preview) {
        if (typeof store.preview.passage === "string" && store.preview.passage) setPassage(store.preview.passage);
        const savedVocab = Array.isArray(store.preview.vocab) ? (store.preview.vocab as VocabItem[]) : [];
        const savedSynonyms = Array.isArray(store.preview.synonyms) ? (store.preview.synonyms as SynAntItem[]) : [];
        const savedSummary = typeof store.preview.summary === "string" ? store.preview.summary : "";
        const savedExam = store.preview.examBlock ? (store.preview.examBlock as ExamBlock) : null;
        const savedPassage = typeof store.preview.passage === "string" && store.preview.passage
          ? store.preview.passage
          : (typeof data.passage_text === "string" ? data.passage_text : "");

        setVocab(savedVocab);
        setSynonyms(sanitizeSynonymItems(savedSynonyms, savedPassage));
        setSummary(savedSummary);
        setExamBlock(savedExam);

        setVocabStatus(savedVocab.length > 0 ? "done" : "idle");
        setSynonymsStatus(savedSynonyms.length > 0 ? "done" : "idle");
        setPreviewStatus(savedSummary || savedExam ? "done" : "idle");
      } else if (typeof data.passage_text === "string" && data.passage_text) {
        setPassage(data.passage_text);
      }
    };
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, [passageId]);

  const isGenerating = vocabStatus === "loading" || synonymsStatus === "loading" || previewStatus === "loading";

  const handleGenerate = async () => {
    if (!passage.trim() || isGenerating) return;
    setVocabStatus("loading");
    setSynonymsStatus("loading");
    setPreviewStatus("loading");

    const vocabPromise = invokeRetry("analyze-vocab", { passage, count: 30 })
      .then((d) => { setVocab(d.vocab || []); setVocabStatus("done"); })
      .catch((e) => { toast.error(`어휘 생성 실패: ${e.message}`); setVocabStatus("error"); });

    const synPromise = invokeRetry("analyze-synonyms", { passage })
      .then((d) => {
        setSynonyms(sanitizeSynonymItems(d.synonyms || [], passage, { filterByPassage: true }));
        setSynonymsStatus("done");
      })
      .catch((e) => { toast.error(`동/반의어 생성 실패: ${e.message}`); setSynonymsStatus("error"); });

    const capitalizeFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    const previewPromise = invokeRetry("analyze-preview", { passage })
      .then((d) => {
        setSummary(d.summary || "");
        const eb = d.exam_block;
        if (eb) eb.topic = capitalizeFirst(eb.topic);
        setExamBlock(eb || null);
        setPreviewStatus("done");
      })
      .catch((e) => { toast.error(`요약 생성 실패: ${e.message}`); setPreviewStatus("error"); });

    await Promise.allSettled([vocabPromise, synPromise, previewPromise]);
  };

  const handleWordClick = useCallback(async (word: string) => {
    const lower = word.toLowerCase();
    if (vocab.some((v) => v.word.toLowerCase() === lower)) {
      toast.info("이미 추가된 단어입니다.");
      return;
    }
    setAddingWord(lower);
    try {
      const data = await invokeRetry("analyze-single-vocab", { word, passage });
      if (data.vocab) {
        setVocab((prev) => [...prev, data.vocab]);
        toast.success(`"${word}" 추가됨`);
      }
    } catch (e: any) {
      toast.error(`단어 추가 실패: ${e.message}`);
    } finally {
      setAddingWord(null);
    }
  }, [vocab, passage]);

  const handleVocabDelete = useCallback((index: number) => {
    setVocab((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleVocabEdit = useCallback((index: number, field: keyof VocabItem, value: string) => {
    setVocab((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  }, []);

  const handleVocabRegenItem = useCallback(async (index: number) => {
    const item = vocab[index];
    if (!item) return;
    try {
      const data = await invokeRetry("analyze-single-vocab", { word: item.word, passage });
      if (data.vocab) {
        setVocab((prev) => prev.map((v, i) => i === index ? data.vocab : v));
        toast.success(`"${item.word}" 재생성 완료`);
      }
    } catch (e: any) {
      toast.error(`재생성 실패: ${e.message}`);
    }
  }, [vocab, passage]);

  const regenSummary = useCallback(async (): Promise<string> => {
    const data = await invokeRetry("analyze-preview", { passage });
    return data.summary || "";
  }, [passage]);

  const regenSynonyms = useCallback(async (): Promise<SynAntItem[]> => {
    const data = await invokeRetry("analyze-synonyms", { passage });
    return sanitizeSynonymItems(data.synonyms || [], passage, { filterByPassage: true });
  }, [passage]);

  const handleEnrichRow = useCallback(async (idx: number) => {
    const item = synonyms[idx];
    if (!item) return;
    setEnrichingIdx(idx);
    try {
      const data = await invokeRetry("enrich-synonym", {
        word: item.word,
        existingSynonyms: item.synonym,
        existingAntonyms: item.antonym,
        passage,
      });
      setSynonyms((prev) =>
        sanitizeSynonymItems(prev.map((s, i) => {
          if (i !== idx) return s;
          const newSyn = data.synonyms ? `${s.synonym}, ${data.synonyms}` : s.synonym;
          const newAnt = data.antonyms ? `${s.antonym}, ${data.antonyms}` : s.antonym;
          return { ...s, synonym: newSyn, antonym: newAnt };
        }), passage)
      );
      toast.success(`"${item.word}" 동/반의어 추가 완료`);
    } catch (e: any) {
      toast.error(`추가 실패: ${e.message}`);
    } finally {
      setEnrichingIdx(null);
    }
  }, [synonyms, passage]);

  const handleSynonymDeleteRow = useCallback((idx: number) => {
    setSynonyms((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleRequestAddFromPassage = useCallback(() => {
    setSynonymSelectMode((prev) => !prev);
  }, []);

  const handleSynonymWordClick = useCallback(async (word: string) => {
    const lower = word.toLowerCase();
    if (synonyms.some((s) => s.word.toLowerCase().replace(/\s*\(.*?\)\s*$/, "") === lower)) {
      toast.info("이미 추가된 단어입니다.");
      return;
    }
    setAddingSynonymWord(lower);
    try {
      const data = await invokeRetry("enrich-synonym", {
        word,
        existingSynonyms: "",
        existingAntonyms: "",
        passage,
      });
      const displayWord = data.word_ko ? `${word} (${data.word_ko})` : word;
      const newItem: SynAntItem = {
        word: displayWord,
        synonym: data.synonyms || "",
        antonym: data.antonyms || "",
      };
      setSynonyms((prev) => sanitizeSynonymItems([...prev, newItem], passage));
      toast.success(`"${word}" 동반의어 추가됨`);
    } catch (e: any) {
      toast.error(`동반의어 추가 실패: ${e.message}`);
    } finally {
      setAddingSynonymWord(null);
    }
  }, [synonyms, passage]);

  const regenExamTopic = useCallback(async () => {
    const data = await invokeRetry("analyze-preview", { passage });
    const t = data.exam_block?.topic || "";
    return { en: t ? t.charAt(0).toUpperCase() + t.slice(1) : t, ko: data.exam_block?.topic_ko };
  }, [passage]);

  const regenExamTitle = useCallback(async () => {
    const data = await invokeRetry("analyze-preview", { passage });
    return { en: data.exam_block?.title || "", ko: data.exam_block?.title_ko };
  }, [passage]);

  const regenExamSummary = useCallback(async () => {
    const data = await invokeRetry("analyze-preview", { passage });
    return { en: data.exam_block?.one_sentence_summary || "", ko: data.exam_block?.one_sentence_summary_ko };
  }, [passage]);

  const handleExportPdf = async () => {
    try {
      const doc = createElement(PreviewPdf, { vocab, synonyms, summary, examBlock, title: pdfTitle }) as any;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfTitle}+preview.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF 다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error(`PDF 저장 실패: ${err.message}`);
    }
  };

  const handlePreviewPdf = async () => {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      const doc = createElement(PreviewPdf, { vocab, synonyms, summary, examBlock, title: pdfTitle }) as any;
      const blob = await pdf(doc).toBlob();
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

  const handleTogglePreviewCompleted = async () => {
    if (!passageId) {
      toast.info("지문에서 진입한 경우에만 완료 저장이 가능합니다.");
      return;
    }
    const next = !previewCompleted;
    setPreviewCompleted(next);
    const mergedStore = mergePassageStore(baseResultsJson, {
      preview: { passage, pdfTitle, vocab, synonyms, summary, examBlock: examBlock || null },
      completion: {
        previewCompleted: next,
        previewCompletedAt: next ? new Date().toISOString() : null,
      },
    });
    const { error } = await supabase
      .from("passages")
      .update({
        passage_text: passage,
        pdf_title: pdfTitle,
        results_json: mergedStore as any,
        updated_at: new Date().toISOString(),
      })
      .eq("id", passageId);
    if (error) {
      setPreviewCompleted(!next);
      toast.error("완료 상태 저장 실패");
      return;
    }
    setBaseResultsJson(mergedStore);
    toast.success(next ? "프리뷰 완료로 표시됨" : "프리뷰 완료 표시 해제");
  };

  const canExport = vocab.length > 0 || synonyms.length > 0 || summary;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <h1 className="text-xl font-bold tracking-wide">{pdfTitle}</h1>
          </div>
          {canExport && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">완료</span>
                <Switch
                  checked={previewCompleted}
                  onCheckedChange={handleTogglePreviewCompleted}
                  disabled={loadingSavedState}
                  className="scale-75"
                />
              </div>
              <button onClick={handlePreviewPdf} disabled={pdfGenerating} className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors disabled:opacity-50">
                {pdfGenerating ? "생성 중..." : "PDF 미리보기"}
              </button>
              <button onClick={handleExportPdf} className="px-3 py-1 rounded-full border border-foreground text-foreground text-[11px] font-medium hover:bg-foreground hover:text-background transition-colors">
                PDF 저장
              </button>
            </div>
          )}
        </div>
      </header>


      <main className="max-w-4xl mx-auto px-6 py-6 space-y-8">
        <PreviewPassageInput
          passage={passage}
          setPassage={setPassage}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          vocabReady={vocabStatus === "done"}
          onWordClick={handleWordClick}
          addingWord={addingWord}
          synonymSelectMode={synonymSelectMode}
          onSynonymWordClick={handleSynonymWordClick}
          addingSynonymWord={addingSynonymWord}
        />

        <PreviewVocabSection
          vocab={vocab}
          status={vocabStatus}
          onDelete={handleVocabDelete}
          onEdit={handleVocabEdit}
          onRegenItem={handleVocabRegenItem}
        />

        <PreviewSummarySection
          summary={summary}
          status={previewStatus}
          onSummaryChange={setSummary}
          onRegenerate={regenSummary}
        />

        <PreviewSynonymsSection
          synonyms={synonyms}
          vocab={vocab}
          status={synonymsStatus}
          onSynonymsChange={(next) => setSynonyms(sanitizeSynonymItems(next, passage))}
          onRegenerate={regenSynonyms}
          onEnrichRow={handleEnrichRow}
          enrichingIdx={enrichingIdx}
          onDeleteRow={handleSynonymDeleteRow}
          onRequestAddFromPassage={handleRequestAddFromPassage}
          synonymSelectMode={synonymSelectMode}
        />

        <PreviewExamSection
          examBlock={examBlock}
          status={previewStatus}
          onExamChange={setExamBlock}
          onRegenerateTopic={regenExamTopic}
          onRegenerateTitle={regenExamTitle}
          onRegenerateSummary={regenExamSummary}
        />
      </main>

      <Dialog open={!!pdfBlobUrl} onOpenChange={(open) => { if (!open) closePdfPreview(); }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <span className="text-sm font-medium">PDF 미리보기</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPdf}
                className="px-3 py-1 rounded-full text-[11px] font-medium border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
              >
                다운로드
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
