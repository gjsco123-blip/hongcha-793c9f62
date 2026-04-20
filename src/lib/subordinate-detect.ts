/**
 * Heuristic subordinate-clause detector for manual s/v labelling.
 *
 * Given the click target (chunkIndex, wordIndex) and all chunks of the same
 * sentence, decide whether the target word should be labelled as a subordinate
 * clause member (s'/v') or a matrix clause member (s/v).
 *
 * Strategy (in priority order):
 *  1. If the same chunk already contains a segment marked `isSubordinate`, the
 *     click is treated as inside that subordinate scope.
 *  2. Otherwise, walk backwards through the flattened word list looking for the
 *     nearest subordinator keyword (relative pronoun / subordinating
 *     conjunction). If found within the same sentence and not separated by a
 *     hard sentence boundary, treat as subordinate.
 *  3. Default: matrix (return false).
 */
import type { Chunk } from "@/lib/chunk-utils";
import { segmentsToWords } from "@/lib/chunk-utils";

const SUBORDINATORS = new Set([
  // Relative pronouns / determiners
  "that", "which", "who", "whom", "whose",
  // Wh- (noun/adverbial clauses)
  "what", "when", "where", "why", "how",
  // Conditional / concessive
  "if", "whether", "unless",
  // Causal / temporal / concessive
  "because", "although", "though", "while", "since",
  "until", "till", "after", "before", "as",
]);

export function detectSubordinate(
  chunks: Chunk[],
  chunkIndex: number,
  wordIndex: number,
): boolean {
  if (chunkIndex < 0 || chunkIndex >= chunks.length) return false;

  // Rule 1: existing subordinate segment in the same chunk → inside subordinate.
  const sameChunk = chunks[chunkIndex];
  if (sameChunk.segments.some((s) => s.isSubordinate)) return true;

  // Rule 2: walk backwards through flattened words across earlier chunks until
  // we find a subordinator keyword or hit a hard sentence boundary.
  type FlatWord = { word: string; ci: number; wi: number };
  const flat: FlatWord[] = [];
  chunks.forEach((c, ci) => {
    const words = segmentsToWords(c.segments);
    words.forEach((w, wi) => flat.push({ word: w.word, ci, wi }));
  });

  // Find the absolute index of the click target.
  const targetIdx = flat.findIndex((f) => f.ci === chunkIndex && f.wi === wordIndex);
  if (targetIdx <= 0) return false;

  for (let k = targetIdx - 1; k >= 0; k--) {
    const raw = flat[k].word;
    // Hard boundary: terminal punctuation between target and the keyword stops the search.
    if (/[.!?;]$/.test(raw)) return false;
    const lower = raw.toLowerCase().replace(/[^a-z']/g, "");
    if (!lower) continue;
    if (SUBORDINATORS.has(lower)) return true;
  }
  return false;
}
