// Parse tagged string into array of { tag: number, text: string, segments: ChunkSegment[] }

export interface ChunkSegment {
  text: string;
  isVerb: boolean;
}

export interface Chunk {
  tag: number;
  text: string;
  segments: ChunkSegment[];
}

/** Parse <v>...</v> tags inside a chunk's text into segments */
function parseVerbSegments(raw: string): ChunkSegment[] {
  const segments: ChunkSegment[] = [];
  const vRegex = /<v>(.*?)<\/v>/g;
  let lastIndex = 0;
  let match;

  while ((match = vRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.substring(lastIndex, match.index), isVerb: false });
    }
    segments.push({ text: match[1], isVerb: true });
    lastIndex = vRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({ text: raw.substring(lastIndex), isVerb: false });
  }

  // If no <v> tags found, return single non-verb segment
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
    const cleanText = rawText.replace(/<\/?v>/g, "");
    chunks.push({
      tag: parseInt(match[1]),
      text: cleanText,
      segments: parseVerbSegments(rawText),
    });
  }

  // Collect untagged text (text outside any <cN>...</cN>) and merge into nearest chunk
  if (chunks.length > 0) {
    let pos = 0;
    for (const range of matchedRanges) {
      if (range.start > pos) {
        const orphan = tagged.substring(pos, range.start).replace(/<\/?c\d+>/g, "").replace(/<\/?v>/g, "").trim();
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
      const trailing = tagged.substring(pos).replace(/<\/?c\d+>/g, "").replace(/<\/?v>/g, "").trim();
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
        .map((s) => (s.isVerb ? `<v>${s.text}</v>` : s.text))
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
export function segmentsToWords(segments: ChunkSegment[]): { word: string; isVerb: boolean }[] {
  const words: { word: string; isVerb: boolean }[] = [];
  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (part.trim()) {
        words.push({ word: part, isVerb: seg.isVerb });
      }
    }
  }
  return words;
}

/** Rebuild segments from word-level verb info */
export function wordsToSegments(words: { word: string; isVerb: boolean }[]): ChunkSegment[] {
  if (words.length === 0) return [{ text: "", isVerb: false }];
  
  const segments: ChunkSegment[] = [];
  let current = { text: words[0].word, isVerb: words[0].isVerb };

  for (let i = 1; i < words.length; i++) {
    if (words[i].isVerb === current.isVerb) {
      current.text += " " + words[i].word;
    } else {
      // Add trailing space to non-last segments for proper spacing
      segments.push({ text: current.text + " ", isVerb: current.isVerb });
      current = { text: words[i].word, isVerb: words[i].isVerb };
    }
  }
  segments.push(current);
  return segments;
}
