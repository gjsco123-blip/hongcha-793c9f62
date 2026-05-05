export interface VocabItem {
  word: string;
  pos: string;
  meaning_ko: string;
  in_context: string;
}

export interface SynAntItem {
  word: string;
  synonym: string;
  antonym: string;
}

export interface ExamBlock {
  topic_basic: string;
  topic_basic_ko?: string;
  topic_advanced: string;
  topic_advanced_ko?: string;
  one_sentence_summary: string;
  one_sentence_summary_ko?: string;
}

export type SectionStatus = "idle" | "loading" | "done" | "error";
