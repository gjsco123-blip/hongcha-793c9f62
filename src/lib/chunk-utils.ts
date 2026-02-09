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
  const regex = /<c(\d+)>(.*?)<\/c\1>/g;
  const chunks: Chunk[] = [];
  let match;
  while ((match = regex.exec(tagged)) !== null) {
    const rawText = match[2].trim();
    const cleanText = rawText.replace(/<\/?v>/g, "");
    chunks.push({
      tag: parseInt(match[1]),
      text: cleanText,
      segments: parseVerbSegments(rawText),
    });
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
