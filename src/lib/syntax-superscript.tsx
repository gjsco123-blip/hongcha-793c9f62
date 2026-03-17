import React from "react";

export interface SyntaxNoteWithTarget {
  id: number;
  content: string;
  targetText?: string;
}

/**
 * Tokenize text into words with their character positions.
 * A "word" is a sequence of word characters (letters, digits, apostrophes, unicode marks).
 */
function tokenize(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const re = /[A-Za-z'\u2019\u0300-\u036f0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ word: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/**
 * Find the token-sequence match of targetText within originalText.
 * Returns the character range [start, end) in originalText, or null if not found.
 * Uses word-boundary-aware matching: "it" won't match inside "point".
 */
function findTargetSpan(
  originalText: string,
  targetText: string
): { start: number; end: number } | null {
  const wordCharRe = /[A-Za-z'\u2019\u0300-\u036f0-9]/;
  const expandToTokenBounds = (start: number, end: number) => {
    let s = Math.max(0, start);
    let e = Math.min(originalText.length, end);
    while (s > 0 && wordCharRe.test(originalText[s - 1])) s--;
    while (e < originalText.length && wordCharRe.test(originalText[e])) e++;
    return { start: s, end: e };
  };

  const srcTokens = tokenize(originalText);
  const tgtTokens = tokenize(targetText);
  if (tgtTokens.length === 0 || srcTokens.length === 0) return null;

  for (let i = 0; i <= srcTokens.length - tgtTokens.length; i++) {
    let match = true;
    for (let j = 0; j < tgtTokens.length; j++) {
      if (srcTokens[i + j].word !== tgtTokens[j].word) {
        match = false;
        break;
      }
    }
    if (match) {
      return {
        start: srcTokens[i].start,
        end: srcTokens[i + tgtTokens.length - 1].end,
      };
    }
  }

  // Fallback 1: direct substring match (helps when user selects partial token)
  const srcLower = originalText.toLowerCase();
  const tgtLower = targetText.toLowerCase().trim();
  if (tgtLower) {
    const directIdx = srcLower.indexOf(tgtLower);
    if (directIdx !== -1) {
      return expandToTokenBounds(directIdx, directIdx + tgtLower.length);
    }
  }

  // Fallback 2: whitespace-insensitive match (helps when selection text collapses spaces)
  if (tgtLower) {
    const compactSrcChars: string[] = [];
    const compactToOrigIndex: number[] = [];
    for (let i = 0; i < srcLower.length; i++) {
      const ch = srcLower[i];
      if (/\s/.test(ch)) continue;
      compactSrcChars.push(ch);
      compactToOrigIndex.push(i);
    }
    const compactSrc = compactSrcChars.join("");
    const compactTgt = tgtLower.replace(/\s+/g, "");
    if (compactTgt) {
      const compactIdx = compactSrc.indexOf(compactTgt);
      if (compactIdx !== -1) {
        const origStart = compactToOrigIndex[compactIdx];
        const origEnd = compactToOrigIndex[compactIdx + compactTgt.length - 1] + 1;
        return expandToTokenBounds(origStart, origEnd);
      }
    }
  }

  return null;
}

/**
 * Compute superscript positions by matching targetText against the original text
 * using word-token-sequence matching (prevents partial-word matches).
 * Returns a Map from character start-position to array of note IDs.
 */
export function computeSuperscriptPositions(
  originalText: string,
  syntaxNotes: SyntaxNoteWithTarget[]
): Map<number, number[]> {
  const result = new Map<number, number[]>();

  for (const note of syntaxNotes) {
    if (!note.targetText) continue;
    const span = findTargetSpan(originalText, note.targetText);
    if (!span) continue;
    const arr = result.get(span.start) || [];
    arr.push(note.id);
    result.set(span.start, arr);
  }

  return result;
}

/**
 * Renders text with superscript numbers where syntaxNotes' targetText matches.
 * Uses token-sequence matching for accuracy.
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

  // Find all matches with positions using token matching
  const matches: { start: number; end: number; id: number }[] = [];

  for (const ann of annotations) {
    const span = findTargetSpan(text, ann.target);
    if (span) {
      matches.push({ start: span.start, end: span.end, id: ann.id });
    }
  }

  if (matches.length === 0) return [text];

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  const elements: React.ReactNode[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.start < cursor) continue; // skip overlapping
    if (m.start > cursor) {
      elements.push(text.slice(cursor, m.start));
    }
    elements.push(
      <React.Fragment key={`sup-${m.id}`}>
        <sup className="text-[8px] font-bold text-muted-foreground mr-[1px]" style={{ verticalAlign: 'super', position: 'relative', top: '-0.6em' }}>{m.id}</sup>
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
 * Reorder syntax notes by their targetText position in the original sentence.
 * Uses token-sequence matching. Notes without targetText go to the end.
 */
export function reorderNotesByPosition<T extends { id: number; content: string; targetText?: string }>(
  notes: T[],
  originalText: string
): T[] {
  if (notes.length <= 1) return notes.map((n, i) => ({ ...n, id: i + 1 }));

  const withPos = notes.map((n) => {
    const span = n.targetText ? findTargetSpan(originalText, n.targetText) : null;
    return { note: n, pos: span ? span.start : Infinity };
  });
  withPos.sort((a, b) => a.pos - b.pos);
  return withPos.map((item, i) => ({ ...item.note, id: i + 1 }));
}

/**
 * Check if a word range in chunks matches any targetText and return the note id.
 * Uses token-sequence matching against the full text.
 */
export function findSuperscriptForWord(
  fullText: string,
  wordStart: number,
  wordEnd: number,
  syntaxNotes: SyntaxNoteWithTarget[]
): number | null {
  for (const note of syntaxNotes) {
    if (!note.targetText) continue;
    const span = findTargetSpan(fullText, note.targetText);
    if (!span) continue;
    // Show superscript on the last word of the match
    if (wordEnd <= span.end && wordEnd > span.end - 3 && wordStart >= span.start) {
      return note.id;
    }
  }
  return null;
}

/**
 * Exported for PDF and other consumers that need the raw span data.
 */
export { findTargetSpan };
