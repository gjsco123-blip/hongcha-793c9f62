import React from "react";

export interface SyntaxNoteWithTarget {
  id: number;
  content: string;
  targetText?: string;
}

const COMMON_ENGLISH_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
  "can", "could", "did", "do", "does", "for", "from", "had", "has", "have",
  "he", "her", "him", "his", "if", "in", "into", "is", "it", "its", "may",
  "might", "must", "not", "of", "on", "or", "our", "she", "that", "the",
  "their", "them", "there", "they", "this", "to", "us", "was", "we", "were",
  "which", "who", "will", "with", "would", "you", "your",
]);

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

function normalizeAlphaWord(word: string): string {
  return String(word ?? "")
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function extractEnglishHints(noteContent: string): string[] {
  const words = String(noteContent ?? "").match(/[A-Za-z][A-Za-z'\u2019-]*/g) || [];
  return Array.from(
    new Set(
      words
        .map(normalizeAlphaWord)
        .filter((w) => w.length >= 2 && !COMMON_ENGLISH_STOPWORDS.has(w))
    )
  );
}

function isVerbFocusedNote(noteContent: string): boolean {
  const text = String(noteContent ?? "").toLowerCase();
  return /(동사|수일치|조동사|수동태|시제|서술어|3형식|4형식|5형식)/.test(text);
}

function isLikelyVerbToken(word: string): boolean {
  const w = normalizeAlphaWord(word);
  if (!w || COMMON_ENGLISH_STOPWORDS.has(w)) return false;
  if (["am", "is", "are", "was", "were", "be", "been", "being", "do", "does", "did", "have", "has", "had"].includes(w)) {
    return true;
  }
  return /(ed|ing|en|ify|ise|ize|ate|s)$/.test(w);
}

function tokenMatchesHint(tokenWord: string, hint: string): boolean {
  const token = normalizeAlphaWord(tokenWord);
  const h = normalizeAlphaWord(hint);
  if (!token || !h) return false;
  if (token === h) return true;
  if (h.length >= 4 && token.startsWith(h)) return true; // inspire -> inspires
  if (token.length >= 4 && h.startsWith(token)) return true;
  return false;
}

function chooseAnchorOffset(
  originalText: string,
  span: { start: number; end: number },
  noteContent: string
): number {
  const tokensInSpan = tokenize(originalText).filter(
    (tok) => tok.start >= span.start && tok.end <= span.end
  );
  if (tokensInSpan.length === 0) return span.start;

  const hints = extractEnglishHints(noteContent);
  const verbFocused = isVerbFocusedNote(noteContent);

  if (verbFocused) {
    const hintedVerb = tokensInSpan.find(
      (tok) =>
        !COMMON_ENGLISH_STOPWORDS.has(tok.word) &&
        hints.some((hint) => tokenMatchesHint(tok.word, hint))
    );
    if (hintedVerb) return hintedVerb.start;

    const firstVerbLike = tokensInSpan.find((tok) => isLikelyVerbToken(tok.word));
    if (firstVerbLike) return firstVerbLike.start;
  }

  const hintedToken = tokensInSpan.find(
    (tok) =>
      !COMMON_ENGLISH_STOPWORDS.has(tok.word) &&
      hints.some((hint) => tokenMatchesHint(tok.word, hint))
  );
  if (hintedToken) return hintedToken.start;

  return tokensInSpan[0].start;
}

/**
 * Compute superscript positions by matching targetText against the original text
 * using word-token-sequence matching (prevents partial-word matches).
 * Returns a Map from character anchor-position to array of note IDs.
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
    const anchor = chooseAnchorOffset(originalText, span, note.content);
    const arr = result.get(anchor) || [];
    if (!arr.includes(note.id)) arr.push(note.id);
    result.set(anchor, arr);
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
  const positions = computeSuperscriptPositions(text, syntaxNotes);
  if (positions.size === 0) return [text];

  const anchors = [...positions.entries()]
    .filter(([offset]) => Number.isFinite(offset) && offset >= 0 && offset <= text.length)
    .sort((a, b) => a[0] - b[0]);
  if (anchors.length === 0) return [text];

  const elements: React.ReactNode[] = [];
  let cursor = 0;

  for (const [offset, ids] of anchors) {
    if (offset > cursor) {
      elements.push(text.slice(cursor, offset));
    }
    [...ids].sort((a, b) => a - b).forEach((id, idx) => {
      elements.push(
        <sup
          key={`sup-${offset}-${id}-${idx}`}
          className="text-[8px] font-bold text-muted-foreground mr-[1px]"
          style={{ verticalAlign: "super", position: "relative", top: "-0.6em" }}
        >
          {id}
        </sup>
      );
    });
    cursor = offset;
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
  const positions = computeSuperscriptPositions(fullText, syntaxNotes);
  for (const [offset, ids] of positions) {
    if (offset >= wordStart && offset < wordEnd) {
      return ids[0] ?? null;
    }
  }
  return null;
}

/**
 * Exported for PDF and other consumers that need the raw span data.
 */
export { findTargetSpan };
