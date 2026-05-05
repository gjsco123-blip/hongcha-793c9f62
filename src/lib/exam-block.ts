export interface ExamBlockLike {
  topic?: string;
  topic_ko?: string;
  topic_basic?: string;
  topic_basic_ko?: string;
  topic_advanced?: string;
  topic_advanced_ko?: string;
  one_sentence_summary?: string;
  one_sentence_summary_ko?: string;
}

export function getDisplaySummary(block: ExamBlockLike | null | undefined): string {
  if (!block) return "";
  return (block.one_sentence_summary_ko || block.one_sentence_summary || "").trim();
}

export function normalizeExamBlock<T extends ExamBlockLike | null | undefined>(block: T): T {
  if (!block) return block;

  const topicBasic = (block.topic_basic || block.topic || "").trim();
  const topicBasicKo = (block.topic_basic_ko || block.topic_ko || "").trim();
  const topicAdvanced = (block.topic_advanced || "").trim();
  const topicAdvancedKo = (block.topic_advanced_ko || "").trim();

  return {
    ...block,
    topic_basic: topicBasic,
    topic_basic_ko: topicBasicKo || undefined,
    topic_advanced: topicAdvanced,
    topic_advanced_ko: topicAdvancedKo || undefined,
  } as T;
}
