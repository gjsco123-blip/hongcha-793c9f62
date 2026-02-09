// Parse tagged string into array of { tag: number, text: string }
export interface Chunk {
  tag: number;
  text: string;
}

export function parseTagged(tagged: string): Chunk[] {
  const regex = /<c(\d+)>(.*?)<\/c\1>/g;
  const chunks: Chunk[] = [];
  let match;
  while ((match = regex.exec(tagged)) !== null) {
    chunks.push({ tag: parseInt(match[1]), text: match[2].trim() });
  }
  return chunks;
}

export function chunksToTagged(chunks: Chunk[]): string {
  return chunks.map((c) => `<c${c.tag}>${c.text}</c${c.tag}>`).join(" ");
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
