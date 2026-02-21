import { useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { CompareOverlay } from "./CompareOverlay";
import { RefreshCw } from "lucide-react";
import type { ExamBlock, SectionStatus } from "./types";

interface Props {
  examBlock: ExamBlock | null;
  status: SectionStatus;
  onExamChange: (v: ExamBlock) => void;
  onRegenerateTopic: () => Promise<string>;
  onRegenerateTitle: () => Promise<string>;
  onRegenerateSummary: () => Promise<string>;
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
  const [candidate, setCandidate] = useState<{ field: string; oldVal: string; newVal: string } | null>(null);

  if (status === "idle" || !examBlock) return null;

  const update = (patch: Partial<ExamBlock>) => onExamChange({ ...examBlock, ...patch });

  const handleRegen = async (field: string, fn: () => Promise<string>) => {
    setRegenField(field);
    try {
      const newVal = await fn();
      const oldVal = field === "topic" ? examBlock.topic : field === "title" ? examBlock.title : examBlock.one_sentence_summary;
      setCandidate({ field, oldVal, newVal });
    } finally {
      setRegenField(null);
    }
  };

  const acceptCandidate = () => {
    if (!candidate) return;
    if (candidate.field === "topic") update({ topic: candidate.newVal });
    else if (candidate.field === "title") update({ title: candidate.newVal });
    else update({ one_sentence_summary: candidate.newVal });
    setCandidate(null);
  };

  return (
    <section className="border-t border-border pt-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-4 flex items-center gap-2">
        Topic / Title / Summary
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
          <div className="flex items-center mb-1.5">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em]">Summary</p>
            {status === "done" && <FieldRegenButton onClick={() => handleRegen("summary", onRegenerateSummary)} loading={regenField === "summary"} />}
          </div>
          <input value={examBlock.one_sentence_summary} onChange={(e) => update({ one_sentence_summary: e.target.value })}
            className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1" />
          {examBlock.one_sentence_summary_ko !== undefined && (
            <input value={examBlock.one_sentence_summary_ko || ""} onChange={(e) => update({ one_sentence_summary_ko: e.target.value })}
              className="w-full text-xs text-muted-foreground/60 mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1" />
          )}
        </div>
      </div>
      {candidate && (
        <CompareOverlay
          title={`${candidate.field.charAt(0).toUpperCase() + candidate.field.slice(1)}`}
          oldContent={<p className="text-sm leading-relaxed">{candidate.oldVal}</p>}
          newContent={<p className="text-sm leading-relaxed">{candidate.newVal}</p>}
          onAccept={acceptCandidate}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
