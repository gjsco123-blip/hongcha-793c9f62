import { useState } from "react";
import { CompareOverlay } from "./CompareOverlay";
import { RefreshCw } from "lucide-react";
import type { ExamBlock, SectionStatus } from "./types";
import { getDisplaySummary } from "@/lib/exam-block";

interface Props {
  examBlock: ExamBlock | null;
  status: SectionStatus;
  onExamChange: (v: ExamBlock) => void;
  onRegenerateTopic: () => Promise<{
    basicEn: string;
    basicKo?: string;
    advancedEn: string;
    advancedKo?: string;
  }>;
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

function buildTopicPreview(block: Pick<ExamBlock, "topic_basic" | "topic_basic_ko" | "topic_advanced" | "topic_advanced_ko">) {
  return [
    `기본형 | ${block.topic_basic || ""}`,
    block.topic_basic_ko || "",
    "",
    `고급형 | ${block.topic_advanced || ""}`,
    block.topic_advanced_ko || "",
  ]
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n")
    .trim();
}

const EXAM_LEAD_CLASS = "w-[48px] shrink-0 pt-0.5 text-[11px] font-bold text-muted-foreground whitespace-nowrap";
const EXAM_LEAD_GRID_CLASS = "grid grid-cols-[24px_8px] items-start";

export function PreviewExamSection({ examBlock, status, onExamChange, onRegenerateTopic, onRegenerateSummary }: Props) {
  const [regenField, setRegenField] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ field: "topic" | "summary"; oldVal: string; newVal: string } | null>(null);

  if (status === "idle" || !examBlock) return null;

  const update = (patch: Partial<ExamBlock>) => onExamChange({ ...examBlock, ...patch });

  const handleTopicRegen = async () => {
    setRegenField("topic");
    try {
      const result = await onRegenerateTopic();
      setCandidate({
        field: "topic",
        oldVal: buildTopicPreview(examBlock),
        newVal: buildTopicPreview({
          topic_basic: result.basicEn,
          topic_basic_ko: result.basicKo,
          topic_advanced: result.advancedEn,
          topic_advanced_ko: result.advancedKo,
          one_sentence_summary: "",
        } as ExamBlock),
      });
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
    if (candidate.field === "topic") {
      const [basicLine = "", basicKo = "", , advancedLine = "", advancedKo = ""] = candidate.newVal.split("\n");
      update({
        topic_basic: basicLine.replace(/^기본형\s*\|\s*/, "").trim(),
        topic_basic_ko: basicKo.trim() || undefined,
        topic_advanced: advancedLine.replace(/^고급형\s*\|\s*/, "").trim(),
        topic_advanced_ko: advancedKo.trim() || undefined,
      });
    } else {
      update({
        one_sentence_summary: candidate.newVal,
        one_sentence_summary_ko: candidate.newVal,
      });
    }
    setCandidate(null);
  };

  return (
    <section className="border-t border-border pt-5">
      <div className="space-y-5">
        <div>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className={EXAM_LEAD_CLASS}>
                <div className={EXAM_LEAD_GRID_CLASS}>
                  <span>주제</span>
                  <span className="text-center">|</span>
                </div>
                <div className="mt-1 flex items-center">
                  {status === "done" && <FieldRegenButton onClick={handleTopicRegen} loading={regenField === "topic"} />}
                  {status === "loading" && <span className="inline-block w-3.5 h-3.5 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full ml-2" />}
                </div>
              </div>
              <div className="flex-1">
                <input
                  value={examBlock.topic_basic}
                  onChange={(e) => update({ topic_basic: e.target.value })}
                  className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
                />
                <input
                  value={examBlock.topic_basic_ko || ""}
                  onChange={(e) => update({ topic_basic_ko: e.target.value || undefined })}
                  className="w-full text-xs text-muted-foreground/60 leading-relaxed mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className={EXAM_LEAD_CLASS}>
                <div className={EXAM_LEAD_GRID_CLASS}>
                  <span />
                  <span className="text-center">|</span>
                </div>
              </div>
              <div className="flex-1">
                <input
                  value={examBlock.topic_advanced}
                  onChange={(e) => update({ topic_advanced: e.target.value })}
                  className="w-full text-sm font-english leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
                />
                <input
                  value={examBlock.topic_advanced_ko || ""}
                  onChange={(e) => update({ topic_advanced_ko: e.target.value || undefined })}
                  className="w-full text-xs text-muted-foreground/60 leading-relaxed mt-0.5 bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-end mb-1.5">
            {status === "done" && <FieldRegenButton onClick={handleSummaryRegen} loading={regenField === "summary"} />}
          </div>
          <div className="flex items-start gap-2.5">
            <div className={EXAM_LEAD_CLASS}>
              <div className={EXAM_LEAD_GRID_CLASS}>
                <span>요약</span>
                <span className="text-center">|</span>
              </div>
            </div>
            <input
              value={getDisplaySummary(examBlock)}
              onChange={(e) =>
                update({
                  one_sentence_summary: e.target.value,
                  one_sentence_summary_ko: e.target.value,
                })
              }
              className="w-full text-sm leading-relaxed bg-transparent border-none outline-none focus:bg-muted/20 rounded px-1 -mx-1"
            />
          </div>
        </div>
      </div>
      {candidate && (
        <CompareOverlay
          title={candidate.field === "summary" ? "요약" : "주제"}
          oldContent={<p className="text-sm leading-relaxed whitespace-pre-wrap">{candidate.oldVal}</p>}
          newContent={<p className="text-sm leading-relaxed whitespace-pre-wrap">{candidate.newVal}</p>}
          onAccept={acceptCandidate}
          onReject={() => setCandidate(null)}
        />
      )}
    </section>
  );
}
