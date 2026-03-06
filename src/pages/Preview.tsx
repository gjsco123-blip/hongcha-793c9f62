import { useState, useEffect, createElement, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { ArrowLeft, FileDown, Eye } from "lucide-react";
import { PreviewPdf } from "@/components/PreviewPdf";
import { PreviewPassageInput } from "@/components/preview/PreviewPassageInput";
import { PreviewVocabSection } from "@/components/preview/PreviewVocabSection";
import { PreviewSummarySection } from "@/components/preview/PreviewSummarySection";
import { PreviewSynonymsSection } from "@/components/preview/PreviewSynonymsSection";
import { PreviewExamSection } from "@/components/preview/PreviewExamSection";
import type { VocabItem, SynAntItem, ExamBlock, SectionStatus } from "@/components/preview/types";

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
  const pdfTitle = (location.state as any)?.pdfTitle || cached?.pdfTitle || "Preview";

  // If navigated with a new passage, use it; otherwise restore cache
  const isNewPassage = !!incomingPassage && incomingPassage !== cached?.passage;

  const [passage, setPassage] = useState(isNewPassage ? incomingPassage : (cached?.passage || incomingPassage || ""));
  const [vocab, setVocab] = useState<VocabItem[]>(isNewPassage ? [] : (cached?.vocab || []));
  const [vocabStatus, setVocabStatus] = useState<SectionStatus>(isNewPassage ? "idle" : (cached?.vocab?.length ? "done" : "idle"));
  const [synonyms, setSynonyms] = useState<SynAntItem[]>(isNewPassage ? [] : (cached?.synonyms || []));
  const [synonymsStatus, setSynonymsStatus] = useState<SectionStatus>(isNewPassage ? "idle" : (cached?.synonyms?.length ? "done" : "idle"));
  const [summary, setSummary] = useState(isNewPassage ? "" : (cached?.summary || ""));
  const [examBlock, setExamBlock] = useState<ExamBlock | null>(isNewPassage ? null : (cached?.examBlock || null));
  const [previewStatus, setPreviewStatus] = useState<SectionStatus>(isNewPassage ? "idle" : (cached?.summary || cached?.examBlock ? "done" : "idle"));
  const [addingWord, setAddingWord] = useState<string | null>(null);

  // Persist state to sessionStorage
  useEffect(() => {
    const state = { passage, vocab, synonyms, summary, examBlock, pdfTitle };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [passage, vocab, synonyms, summary, examBlock, pdfTitle]);

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
      .then((d) => { setSynonyms(d.synonyms || []); setSynonymsStatus("done"); })
      .catch((e) => { toast.error(`동/반의어 생성 실패: ${e.message}`); setSynonymsStatus("error"); });

    const previewPromise = invokeRetry("analyze-preview", { passage })
      .then((d) => { setSummary(d.summary || ""); setExamBlock(d.exam_block || null); setPreviewStatus("done"); })
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

  const regenSummary = useCallback(async (): Promise<string> => {
    const data = await invokeRetry("analyze-preview", { passage });
    return data.summary || "";
  }, [passage]);

  const regenSynonyms = useCallback(async (): Promise<SynAntItem[]> => {
    const data = await invokeRetry("analyze-synonyms", { passage });
    return data.synonyms || [];
  }, [passage]);

  const regenExamTopic = useCallback(async () => {
    const data = await invokeRetry("analyze-preview", { passage });
    return { en: data.exam_block?.topic || "", ko: data.exam_block?.topic_ko };
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
      const link = document.createElement("a");
      link.href = url;
      link.download = "preview.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF가 저장되었습니다.");
    } catch (err: any) {
      toast.error(`PDF 저장 실패: ${err.message}`);
    }
  };

  const canExport = vocab.length > 0 || synonyms.length > 0 || summary;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Eye className="w-5 h-5" />
            <h1 className="text-xl font-bold tracking-wide">{pdfTitle}</h1>
          </div>
          {canExport && (
            <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-4 py-2 border border-foreground text-foreground text-xs font-medium hover:bg-foreground hover:text-background transition-colors">
              <FileDown className="w-3.5 h-3.5" /> PDF 저장
            </button>
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
        />

        <PreviewVocabSection
          vocab={vocab}
          status={vocabStatus}
          onDelete={handleVocabDelete}
          onEdit={handleVocabEdit}
        />

        <PreviewSummarySection
          summary={summary}
          status={previewStatus}
          onSummaryChange={setSummary}
          onRegenerate={regenSummary}
        />

        <PreviewSynonymsSection
          synonyms={synonyms}
          status={synonymsStatus}
          onSynonymsChange={setSynonyms}
          onRegenerate={regenSynonyms}
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
    </div>
  );
}
