export interface VocabItem {
  word: string;
  pos: string;
  meaning_ko: string;
  in_context: string;
}

export interface StructureStep {
  step: number;
  one_line: string;
  evidence: string;
}

export interface ExamBlock {
  topic: string;
  topic_ko?: string;
  title: string;
  title_ko?: string;
  one_sentence_summary: string;
  one_sentence_summary_ko?: string;
}

export type SectionStatus = "idle" | "loading" | "done" | "error";
