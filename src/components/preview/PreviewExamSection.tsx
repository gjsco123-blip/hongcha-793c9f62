import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { CompareOverlay } from "./CompareOverlay";
import { RefreshCw } from "lucide-react";
import type { ExamBlock, SectionStatus } from "./types";
import { formatSummaryKeywords, getDisplaySummary, normalizeSummaryKeywords } from "@/lib/exam-block";

interface Props {
  examBlock: ExamBlock | null;
  status: SectionStatus;
  onExamChange: (v: ExamBlock) => void;
  onRegenerateTopic: () => Promise<{ en: string; ko?: string }>;
  onRegenerateTitle: () => Promise<{ en: string; ko?: string }>;
  onRegenerateSummary: () => Promise<{ summary: string; keywords: string[]; hiddenEnglish?: string }>;
}

function FieldRegenButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 ml-2"
    >
      <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}

export function PreviewExamSection({ examBlock, status, onExamChange, onRegenerateTopic, onRegenerateTitle, onRegenerateSummary }: Props) {
  const [regenField, setRegenField] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ field: string; oldVal: string; oldKo?: string; newVal: string; newKo?: string; hiddenEnglish?: string } | null>(null);

  if (status === "idle" || !examBlock) return null;

  const update = (patch: Partial<ExamBlock>) => onExamChange({ ...examBlock, ...patch });

  const handleRegen = async (field: string, fn: () => Promise<{ en: string; ko?: string }>) => {
    setRegenField(field);
    try {
      const result = await fn();
      const oldVal = field === "topic" ? examBlock.topic : field === "title" ? examBlock.title : examBlock.one_sentence_summary;
      const oldKo = field === "topic" ? examBlock.topic_ko : field === "title" ? examBlock.title_ko : examBlock.one_sentence_summary_ko;
      setCandidate({ field, oldVal, oldKo, newVal: result.en, newKo: result.ko });
    } finally {
      setRegenField(null);
    }
  };

  const handleSummaryRegen = async () => {
    setRegenField("summary");
    try {
      const result = await onRegenerateSummary();
      setCandidate({
        field: "summary",
        oldVal: getDisplaySummary(examBlock),
        oldKo: formatSummaryKeywords(examBlock.summary_keywords),
        newVal: result.summary,
        newKo: formatSummaryKeywords(result.keywords),
        hiddenEnglish: result.hiddenEnglish,
      });
    } finally {
      setRegenField(null);
    }
  };

  const acceptCandidate = () => {
    if (!candidate) return;
    if (candidate.field === "topic") update({ topic: candidate.newVal, topic_ko: candidate.newKo });
    else if (candidate.field === "title") update({ title: candidate.newVal, title_ko: candidate.newKo });
    else update({
      one_sentence_summary: candidate.newVal,
      one_sentence_summary_ko: candidate.newVal,
      one_sentence_summary_en_hidden: candidate.hiddenEnglish,
      summary_keywords: normalizeSummaryKeywords(candidate.newKo),
    });
    setCandidate(null);
  };

  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 flex items-center gap-2">
        Topic / Title
        {status === "loading" && <span className="inline-block w-3.5 h-3.5 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full" />}
      </h2>
      <div className="space-y-5">
        {/* Topic */}
        <div>
          <div className="flex items-center mb-1.5">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em]">Topic</p>
            {status === "done" && <FieldRegenButton onClick={() => handleRegen("topic", onRegenerateTopic)} loading={regenField === "topic"} />}
          </div>
          <input value={examBlock.topic} onChange={(e) => update({ topic: e.target.value })}
            className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1" />
          {examBlock.topic_ko !== undefined && (
            <input value={examBlock.topic_ko || ""} onChange={(e) => update({ topic_ko: e.target.value })}
              className="w-full text-xs text-muted-foreground/60 mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1" />
          )}
        </div>
        {/* Title */}
        <div>
          <div className="flex items-center mb-1.5">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em]">Title</p>
            {status === "done" && <FieldRegenButton onClick={() => handleRegen("title", onRegenerateTitle)} loading={regenField === "title"} />}
          </div>
          <input value={examBlock.title} onChange={(e) => update({ title: e.target.value })}
            className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1" />
          {examBlock.title_ko !== undefined && (
            <input value={examBlock.title_ko || ""} onChange={(e) => update({ title_ko: e.target.value })}
              className="w-full text-xs text-muted-foreground/60 mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1" />
          )}
        </div>
        {/* Summary */}
        <div>
          <div className="flex items-center justify-end mb-1.5">
            {status === "done" && <FieldRegenButton onClick={handleSummaryRegen} loading={regenField === "summary"} />}
          </div>
          <div className="flex items-start gap-3">
            <span className="pt-0.5 text-[11px] font-bold text-muted-foreground whitespace-nowrap">한줄요약 |</span>
            <input
              value={getDisplaySummary(examBlock)}
              onChange={(e) => update({
                one_sentence_summary: e.target.value,
                one_sentence_summary_ko: e.target.value,
                one_sentence_summary_en_hidden: undefined,
              })}
              className="w-full text-sm leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
            />
          </div>
          <input
            value={formatSummaryKeywords(examBlock.summary_keywords)}
            onChange={(e) => update({ summary_keywords: normalizeSummaryKeywords(e.target.value) })}
            placeholder="영단어 : 뜻 / 영단어 : 뜻"
            className="w-full text-xs text-muted-foreground/80 mt-1.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
          />
        </div>
      </div>
      {candidate && (
        <CompareOverlay
          title={candidate.field === "summary" ? "한줄요약" : `${candidate.field.charAt(0).toUpperCase() + candidate.field.slice(1)}`}
          oldContent={
            <div>
              <p className="text-sm leading-relaxed">{candidate.oldVal}</p>
              {candidate.oldKo && <p className="text-xs text-muted-foreground/60 mt-1">{candidate.oldKo}</p>}
            </div>
          }
          newContent={
            <div>
              <p className="text-sm leading-relaxed">{candidate.newVal}</p>
              {candidate.newKo && <p className="text-xs text-muted-foreground/60 mt-1">{candidate.newKo}</p>}
            </div>
          }
          onAccept={acceptCandidate}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
