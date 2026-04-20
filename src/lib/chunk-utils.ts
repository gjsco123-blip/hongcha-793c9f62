// Parse tagged string into array of { tag: number, text: string, segments: ChunkSegment[] }

export interface ChunkSegment {
  text: string;
  isVerb: boolean;
  isSubject?: boolean;
}

export interface Chunk {
  tag: number;
  text: string;
  segments: ChunkSegment[];
}

function hasEnglishLetterToken(word: string): boolean {
  return /[A-Za-z]/.test(word);
}

/**
 * Parse <v>...</v> and <s>...</s> tags inside a chunk's text into segments.
 * Assumes the engine never nests these tags (enforced by the prompt).
 */
function parseTaggedSegments(raw: string): ChunkSegment[] {
  const segments: ChunkSegment[] = [];
  // Match either <v>...</v> or <s>...</s> (non-greedy, no nesting)
  const tagRegex = /<(v|s)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.substring(lastIndex, match.index), isVerb: false });
    }
    if (match[1] === "v") {
      segments.push({ text: match[2], isVerb: true });
    } else {
      segments.push({ text: match[2], isVerb: false, isSubject: true });
    }
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({ text: raw.substring(lastIndex), isVerb: false });
  }

  if (segments.length === 0) {
    segments.push({ text: raw, isVerb: false });
  }

  return segments;
}

export function parseTagged(tagged: string): Chunk[] {
  const regex = /<c(\d+)>([\s\S]*?)<\/c\1>/g;
  const chunks: Chunk[] = [];
  const matchedRanges: { start: number; end: number }[] = [];
  let match;

  while ((match = regex.exec(tagged)) !== null) {
    matchedRanges.push({ start: match.index, end: regex.lastIndex });
    // Remove any residual <cN> or </cN> tags inside the chunk content
    const rawText = match[2].trim().replace(/<\/?c\d+>/g, "");
    const cleanText = rawText.replace(/<\/?v>/g, "").replace(/<\/?s>/g, "");
    chunks.push({
      tag: parseInt(match[1]),
      text: cleanText,
      segments: parseTaggedSegments(rawText),
    });
  }

  // Collect untagged text (text outside any <cN>...</cN>) and merge into nearest chunk
  if (chunks.length > 0) {
    let pos = 0;
    for (const range of matchedRanges) {
      if (range.start > pos) {
        const orphan = tagged
          .substring(pos, range.start)
          .replace(/<\/?c\d+>/g, "")
          .replace(/<\/?v>/g, "")
          .replace(/<\/?s>/g, "")
          .trim();
        if (orphan) {
          // Find the chunk whose range starts at range.start (i.e. the next chunk)
          const idx = matchedRanges.indexOf(range);
          if (idx > 0) {
            // Append to previous chunk
            chunks[idx - 1].text += " " + orphan;
            chunks[idx - 1].segments[chunks[idx - 1].segments.length - 1].text += " " + orphan;
          } else {
            // Prepend to first chunk
            chunks[0].text = orphan + " " + chunks[0].text;
            chunks[0].segments[0].text = orphan + " " + chunks[0].segments[0].text;
          }
        }
      }
      pos = range.end;
    }
    // Check trailing text after last match
    if (pos < tagged.length) {
      const trailing = tagged
        .substring(pos)
        .replace(/<\/?c\d+>/g, "")
        .replace(/<\/?v>/g, "")
        .replace(/<\/?s>/g, "")
        .trim();
      if (trailing) {
        const last = chunks[chunks.length - 1];
        last.text += " " + trailing;
        last.segments[last.segments.length - 1].text += " " + trailing;
      }
    }
  }

  return chunks;
}

/** Reconstruct tagged string, preserving <v> tags from segments */
export function chunksToTagged(chunks: Chunk[]): string {
  return chunks
    .map((c) => {
      const inner = c.segments
        .map((s) => {
          if (s.isVerb) return `<v>${s.text}</v>`;
          if (s.isSubject) return `<s>${s.text}</s>`;
          return s.text;
        })
        .join("");
      return `<c${c.tag}>${inner}</c${c.tag}>`;
    })
    .join(" ");
}

export function chunksToSlash(chunks: Chunk[]): string {
  return chunks.map((c) => c.text).join(" / ");
}

export const CHUNK_COLORS = [
  "chunk-1",
  "chunk-2",
  "chunk-3",
  "chunk-4",
  "chunk-5",
  "chunk-6",
] as const;

export function getChunkColor(index: number): string {
  return CHUNK_COLORS[index % CHUNK_COLORS.length];
}

/** Split a segment's text into individual words, preserving spaces */
export function segmentsToWords(
  segments: ChunkSegment[],
): { word: string; isVerb: boolean; isSubject: boolean }[] {
  const words: { word: string; isVerb: boolean; isSubject: boolean }[] = [];
  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (part.trim()) {
        // Keep punctuation tokens (e.g. "—") from being treated as verbs.
        const hasLetter = hasEnglishLetterToken(part);
        words.push({
          word: part,
          isVerb: seg.isVerb && hasLetter,
          isSubject: !!seg.isSubject && hasLetter,
        });
      }
    }
  }
  return words;
}

/** Rebuild segments from word-level verb info */
export function wordsToSegments(
  words: { word: string; isVerb: boolean; isSubject?: boolean }[],
): ChunkSegment[] {
  if (words.length === 0) return [{ text: "", isVerb: false }];

  const sameKind = (
    a: { isVerb: boolean; isSubject?: boolean },
    b: { isVerb: boolean; isSubject?: boolean },
  ) => a.isVerb === b.isVerb && !!a.isSubject === !!b.isSubject;

  const segments: ChunkSegment[] = [];
  let current: ChunkSegment = {
    text: words[0].word,
    isVerb: words[0].isVerb,
    isSubject: !!words[0].isSubject,
  };

  for (let i = 1; i < words.length; i++) {
    if (sameKind(words[i], current)) {
      current.text += " " + words[i].word;
    } else {
      // Add trailing space to non-last segments for proper spacing
      segments.push({ text: current.text + " ", isVerb: current.isVerb, isSubject: current.isSubject });
      current = { text: words[i].word, isVerb: words[i].isVerb, isSubject: !!words[i].isSubject };
    }
  }
  segments.push(current);
  return segments;
}

// Common adverbs that appear inside verb phrases (e.g., "can always be").
const VERB_PHRASE_ADVERB_WHITELIST = new Set([
  "always", "never", "often", "sometimes", "just", "only", "also",
  "still", "even", "already", "ever", "well", "not", "no",
  "hardly", "barely", "rarely", "almost", "nearly", "quite", "very",
  // Time adverbs
  "now", "then", "soon", "recently", "finally", "eventually",
  "currently", "suddenly", "immediately",
  // Frequency / degree
  "usually", "normally", "generally", "simply", "truly", "really",
  "completely", "fully", "totally", "mostly", "mainly", "largely",
  // Manner (most caught by -ly rule, listed for clarity)
  "clearly", "easily", "quickly", "slowly", "carefully",
]);

function isMergeableInterstitial(text: string): boolean {
  // Block any sentence punctuation that signals a real boundary.
  if (/[,.;:!?]/.test(text)) return false;
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true; // pure whitespace
  if (words.length > 2) return false;
  return words.every((w) => {
    const lower = w.toLowerCase().replace(/[^a-z']/g, "");
    if (!lower) return false;
    if (VERB_PHRASE_ADVERB_WHITELIST.has(lower)) return true;
    if (/ly$/.test(lower) && lower.length > 3) return true;
    return false;
  });
}

/**
 * Render-time helper: merge non-verb segments that sit between two verb segments
 * when they are just whitespace or short adverb phrases. Produces a parallel
 * mapping from original segment index -> merged segment index so callers can
 * remap superscripts/anchors that referenced the old indices.
 *
 * Does NOT mutate the underlying data — only the visual rendering.
 */
export function mergeAdverbsBetweenVerbs(
  segments: ChunkSegment[],
): { segments: ChunkSegment[]; indexMap: number[] } {
  if (segments.length < 2) {
    return { segments: segments.slice(), indexMap: segments.map((_, i) => i) };
  }

  const merged: ChunkSegment[] = [];
  const indexMap: number[] = new Array(segments.length).fill(0);
  let i = 0;

  while (i < segments.length) {
    const cur = segments[i];
    // Try to consume a [verb][interstitial][verb] pattern (and extend as long as it keeps matching).
    if (cur.isVerb && i + 2 < segments.length) {
      let j = i;
      let combinedText = cur.text;
      const consumed: number[] = [i];
      while (
        j + 2 < segments.length &&
        !segments[j + 1].isVerb &&
        segments[j + 2].isVerb &&
        isMergeableInterstitial(segments[j + 1].text)
      ) {
        combinedText += segments[j + 1].text + segments[j + 2].text;
        consumed.push(j + 1, j + 2);
        j += 2;
      }
      if (consumed.length > 1) {
        const mergedIdx = merged.length;
        merged.push({ text: combinedText, isVerb: true });
        for (const idx of consumed) indexMap[idx] = mergedIdx;
        i = j + 1;
        continue;
      }
    }
    indexMap[i] = merged.length;
    merged.push(cur);
    i++;
  }

  return { segments: merged, indexMap };
}
