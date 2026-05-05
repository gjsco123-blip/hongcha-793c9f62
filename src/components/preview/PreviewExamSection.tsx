import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { CompareOverlay } from "./CompareOverlay";
import { RefreshCw } from "lucide-react";
import type { ExamBlock, SectionStatus } from "./types";
import { getDisplaySummary } from "@/lib/exam-block";

interface Props {
  examBlock: ExamBlock | null;
  status: SectionStatus;
  onExamChange: (v: ExamBlock) => void;
  onRegenerateTopic: () => Promise<{ en: string; ko?: string }>;
  onRegenerateSummary: () => Promise<{ summary: string }>;
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

export function PreviewExamSection({ examBlock, status, onExamChange, onRegenerateTopic, onRegenerateSummary }: Props) {
  const [regenField, setRegenField] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ field: string; oldVal: string; oldKo?: string; newVal: string; newKo?: string } | null>(null);

  if (status === "idle" || !examBlock) return null;

  const update = (patch: Partial<ExamBlock>) => onExamChange({ ...examBlock, ...patch });

  const handleRegen = async (field: string, fn: () => Promise<{ en: string; ko?: string }>) => {
    setRegenField(field);
    try {
      const result = await fn();
      const oldVal = field === "topic" ? examBlock.topic : examBlock.one_sentence_summary;
      const oldKo = field === "topic" ? examBlock.topic_ko : examBlock.one_sentence_summary_ko;
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
        newVal: result.summary,
      });
    } finally {
      setRegenField(null);
    }
  };

  const acceptCandidate = () => {
    if (!candidate) return;
    if (candidate.field === "topic") update({ topic: candidate.newVal, topic_ko: candidate.newKo });
    else update({
      one_sentence_summary: candidate.newVal,
      one_sentence_summary_ko: candidate.newVal,
    });
    setCandidate(null);
  };

  return (
    <section className="border-t border-border pt-5">
      <div className="space-y-5">
        {/* Topic */}
        <div>
          <div className="flex items-start gap-3">
            <div className="pt-0.5 text-[11px] font-bold text-muted-foreground whitespace-nowrap flex items-center">
              <span>주제 |</span>
              {status === "done" && <FieldRegenButton onClick={() => handleRegen("topic", onRegenerateTopic)} loading={regenField === "topic"} />}
              {status === "loading" && <span className="inline-block w-3.5 h-3.5 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full ml-2" />}
            </div>
            <div className="flex-1">
              <input
                value={examBlock.topic}
                onChange={(e) => update({ topic: e.target.value })}
                className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
              />
              {examBlock.topic_ko !== undefined && (
                <input
                  value={examBlock.topic_ko || ""}
                  onChange={(e) => update({ topic_ko: e.target.value })}
                  className="w-full text-xs text-muted-foreground/60 leading-relaxed mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
                />
              )}
            </div>
          </div>
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
              })}
              className="w-full text-sm leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
            />
          </div>
        </div>
      </div>
      {candidate && (
        <CompareOverlay
          title={candidate.field === "summary" ? "한줄요약" : `${candidate.field.charAt(0).toUpperCase() + candidate.field.slice(1)}`}
          oldContent={
            <div>
              <p className="text-sm leading-relaxed">{candidate.oldVal}</p>
            </div>
          }
          newContent={
            <div>
              <p className="text-sm leading-relaxed">{candidate.newVal}</p>
            </div>
          }
          onAccept={acceptCandidate}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
