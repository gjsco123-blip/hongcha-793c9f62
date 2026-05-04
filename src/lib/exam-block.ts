export interface ExamBlockLike {
  one_sentence_summary?: string;
  one_sentence_summary_ko?: string;
}

export function getDisplaySummary(block: ExamBlockLike | null | undefined): string {
  if (!block) return "";
  return (block.one_sentence_summary_ko || block.one_sentence_summary || "").trim();
}

export function normalizeExamBlock<T extends ExamBlockLike | null | undefined>(block: T): T {
  return block;
}
