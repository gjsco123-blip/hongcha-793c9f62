import React from "react";

interface SyntaxNoteWithTarget {
  id: number;
  content: string;
  targetText?: string;
}

/**
 * Renders text with superscript numbers where syntaxNotes' targetText matches.
 * Returns an array of React nodes.
 */
export function renderWithSuperscripts(
  text: string,
  syntaxNotes: SyntaxNoteWithTarget[]
): React.ReactNode[] {
  const annotations = syntaxNotes
    .filter((n) => n.targetText)
    .map((n) => ({
      id: n.id,
      target: n.targetText!,
    }));

  if (annotations.length === 0) return [text];

  // Find all matches with positions
  const matches: { start: number; end: number; id: number }[] = [];
  const lowerText = text.toLowerCase();

  for (const ann of annotations) {
    const idx = lowerText.indexOf(ann.target.toLowerCase());
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + ann.target.length, id: ann.id });
    }
  }

  if (matches.length === 0) return [text];

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  const elements: React.ReactNode[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.start > cursor) {
      elements.push(text.slice(cursor, m.start));
    }
    elements.push(
      <React.Fragment key={`sup-${m.id}`}>
        <sup className="text-[9px] font-bold text-muted-foreground mr-[1px]">{m.id}</sup>
        {text.slice(m.start, m.end)}
      </React.Fragment>
    );
    cursor = m.end;
  }

  if (cursor < text.length) {
    elements.push(text.slice(cursor));
  }

  return elements;
}

/**
 * Check if a word range in chunks matches any targetText and return the note id.
 */
export function findSuperscriptForWord(
  fullText: string,
  wordStart: number,
  wordEnd: number,
  syntaxNotes: SyntaxNoteWithTarget[]
): number | null {
  const lowerText = fullText.toLowerCase();

  for (const note of syntaxNotes) {
    if (!note.targetText) continue;
    const targetLower = note.targetText.toLowerCase();
    const matchIdx = lowerText.indexOf(targetLower);
    if (matchIdx === -1) continue;
    const matchEnd = matchIdx + targetLower.length;
    // Show superscript on the last word of the match
    if (wordEnd <= matchEnd && wordEnd > matchEnd - 3 && wordStart >= matchIdx) {
      return note.id;
    }
  }
  return null;
}
