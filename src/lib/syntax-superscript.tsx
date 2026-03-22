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

const LEADING_CONJUNCTIONS = new Set(["and", "but", "or", "so", "yet", "for", "nor"]);
const MODAL_WORDS = new Set(["can", "could", "may", "might", "must", "should", "will", "would"]);

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

function extractRangeStartHint(noteContent: string): string | null {
  const text = String(noteContent ?? "");
  const inParen = text.match(/\(([A-Za-z][A-Za-z'\u2019-]*)\s*~[^)]*\)/);
  if (inParen?.[1]) return normalizeAlphaWord(inParen[1]);
  const plain = text.match(/\b([A-Za-z][A-Za-z'\u2019-]*)\s*~/);
  if (plain?.[1]) return normalizeAlphaWord(plain[1]);
  return null;
}

function extractPatternVerbHint(noteContent: string): string | null {
  const text = String(noteContent ?? "");
  const m = text.match(/\bA\s+([A-Za-z][A-Za-z'\u2019-]*)\s+B\b/i);
  if (!m?.[1]) return null;
  return normalizeAlphaWord(m[1]);
}

function extractSubjectStartHint(noteContent: string): string | null {
  const text = String(noteContent ?? "");
  const m = text.match(/명사\s+([A-Za-z][A-Za-z'\u2019-]*(?:\s+[A-Za-z][A-Za-z'\u2019-]*)*)/i);
  if (!m?.[1]) return null;
  const first = m[1].trim().split(/\s+/)[0] || "";
  return normalizeAlphaWord(first);
}

function findTokenByPredicate(
  tokensInSpan: { word: string; start: number; end: number }[],
  predicate: (token: { word: string; start: number; end: number }) => boolean
): { word: string; start: number; end: number } | null {
  const found = tokensInSpan.find(predicate);
  return found || null;
}

function findPunctuationAnchor(
  noteContent: string,
  originalText: string,
  span: { start: number; end: number }
): number | null {
  const text = String(noteContent ?? "").toLowerCase();
  const candidates: string[] = [];
  if (text.includes("세미콜론")) candidates.push(";");
  if (text.includes("콜론")) candidates.push(":");
  if (text.includes("쉼표") || text.includes("comma")) candidates.push(",");
  if (text.includes("대시") || text.includes("dash")) candidates.push("—", "-");
  if (text.includes("괄호") || text.includes("parenthesis")) candidates.push("(", ")");
  if (candidates.length === 0) return null;

  const inRangeEnd = Math.min(originalText.length, span.end + 4);
  for (const ch of candidates) {
    const inRangeIdx = originalText.indexOf(ch, span.start);
    if (inRangeIdx !== -1 && inRangeIdx < inRangeEnd) return inRangeIdx;
  }

  let best: { idx: number; dist: number } | null = null;
  for (const ch of candidates) {
    let from = 0;
    while (true) {
      const idx = originalText.indexOf(ch, from);
      if (idx === -1) break;
      const dist = Math.abs(idx - span.start);
      if (!best || dist < best.dist) best = { idx, dist };
      from = idx + 1;
    }
  }
  return best?.idx ?? null;
}

function chooseAnchorOffset(
  originalText: string,
  span: { start: number; end: number },
  noteContent: string
): number {
  const allTokens = tokenize(originalText);
  const tokensInSpan = tokenize(originalText).filter(
    (tok) => tok.start >= span.start && tok.end <= span.end
  );
  if (tokensInSpan.length === 0) return span.start;
  const nearbyTokens = allTokens.filter(
    (tok) => tok.start >= Math.max(0, span.start - 48) && tok.end <= Math.min(originalText.length, span.end + 48)
  );

  const rawContent = String(noteContent ?? "");
  const contentLower = rawContent.toLowerCase();
  const hints = extractEnglishHints(noteContent);
  const verbFocused = isVerbFocusedNote(noteContent);
  const rangeStartHint = extractRangeStartHint(noteContent);
  const patternVerbHint = extractPatternVerbHint(noteContent);
  const subjectStartHint = extractSubjectStartHint(noteContent);

  const punctuationAnchor = findPunctuationAnchor(rawContent, originalText, span);
  if (punctuationAnchor !== null) return punctuationAnchor;

  if (rangeStartHint) {
    const rangeStartToken = findTokenByPredicate(tokensInSpan, (tok) => tokenMatchesHint(tok.word, rangeStartHint));
    if (rangeStartToken) return rangeStartToken.start;
  }

  if (/(강조구문|it\s+is\s*~\s*that|it\s+is\s+.+\s+that)/i.test(rawContent)) {
    const itToken = findTokenByPredicate(tokensInSpan, (tok) => normalizeAlphaWord(tok.word).startsWith("it"));
    if (itToken) return itToken.start;
  }

  if (/(to부정사|to-v|to v|to부정사의)/i.test(rawContent)) {
    const toToken = findTokenByPredicate(tokensInSpan, (tok) => normalizeAlphaWord(tok.word) === "to");
    if (toToken) return toToken.start;
  }

  if ((contentLower.includes("조동사") && contentLower.includes("수동")) || /be\s*p\.?p|be\s+pp/i.test(rawContent)) {
    const modalToken = findTokenByPredicate(tokensInSpan, (tok) => MODAL_WORDS.has(normalizeAlphaWord(tok.word)));
    if (modalToken) return modalToken.start;
    const beToken = findTokenByPredicate(tokensInSpan, (tok) => normalizeAlphaWord(tok.word) === "be");
    if (beToken) return beToken.start;
  }

  if (patternVerbHint) {
    const patternVerbToken =
      findTokenByPredicate(tokensInSpan, (tok) => tokenMatchesHint(tok.word, patternVerbHint)) ||
      findTokenByPredicate(nearbyTokens, (tok) => tokenMatchesHint(tok.word, patternVerbHint)) ||
      findTokenByPredicate(allTokens, (tok) => tokenMatchesHint(tok.word, patternVerbHint));
    if (patternVerbToken) return patternVerbToken.start;
  }

  if (contentLower.includes("수일치") || contentLower.includes("주어")) {
    if (subjectStartHint) {
      const subjectHintToken =
        findTokenByPredicate(tokensInSpan, (tok) => tokenMatchesHint(tok.word, subjectStartHint)) ||
        findTokenByPredicate(nearbyTokens, (tok) => tokenMatchesHint(tok.word, subjectStartHint)) ||
        findTokenByPredicate(allTokens, (tok) => tokenMatchesHint(tok.word, subjectStartHint));
      if (subjectHintToken) return subjectHintToken.start;
    }
    const subjectStart = findTokenByPredicate(
      tokensInSpan,
      (tok) => !LEADING_CONJUNCTIONS.has(normalizeAlphaWord(tok.word))
    );
    if (subjectStart) return subjectStart.start;
  }

  if (verbFocused) {
    const hintedVerb = findTokenByPredicate(
      tokensInSpan,
      (tok) =>
        (isLikelyVerbToken(tok.word) || MODAL_WORDS.has(normalizeAlphaWord(tok.word)) || normalizeAlphaWord(tok.word) === "be") &&
        hints.some((hint) => tokenMatchesHint(tok.word, hint))
    ) || findTokenByPredicate(
      nearbyTokens,
      (tok) =>
        (isLikelyVerbToken(tok.word) || MODAL_WORDS.has(normalizeAlphaWord(tok.word)) || normalizeAlphaWord(tok.word) === "be") &&
        hints.some((hint) => tokenMatchesHint(tok.word, hint))
    );
    if (hintedVerb) return hintedVerb.start;

    const firstVerbLike =
      findTokenByPredicate(tokensInSpan, (tok) => isLikelyVerbToken(tok.word) || MODAL_WORDS.has(normalizeAlphaWord(tok.word))) ||
      findTokenByPredicate(nearbyTokens, (tok) => isLikelyVerbToken(tok.word) || MODAL_WORDS.has(normalizeAlphaWord(tok.word)));
    if (firstVerbLike) return firstVerbLike.start;
  }

  const hintedToken = tokensInSpan.find(
    (tok) =>
      !COMMON_ENGLISH_STOPWORDS.has(tok.word) &&
      hints.some((hint) => tokenMatchesHint(tok.word, hint))
  );
  if (hintedToken) return hintedToken.start;

  const firstNonConjunction = findTokenByPredicate(
    tokensInSpan,
    (tok) => !LEADING_CONJUNCTIONS.has(normalizeAlphaWord(tok.word))
  );
  return firstNonConjunction?.start ?? tokensInSpan[0].start;
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
