/**
 * Shared PDF pagination constants & logic.
 * Used by both PdfDocument.tsx (actual PDF) and Index.tsx (preview page-break indicator).
 * Single source of truth — keeps UI preview and PDF output in perfect sync.
 */

import type { Chunk } from "@/lib/chunk-utils";

// ── Interfaces ──────────────────────────────────────────────
export interface PaginationSyntaxNote {
  id: number;
  content: string;
  targetText?: string;
}

export interface PaginationSentence {
  id: number;
  original: string;
  englishChunks: Chunk[];
  koreanLiteralChunks: Chunk[];
  koreanNatural: string;
  syntaxNotes?: PaginationSyntaxNote[];
  hongTNotes?: string;
  hideLiteral?: boolean;
  hideNatural?: boolean;
  hideHongT?: boolean;
}

// ── Layout constants (must match PdfDocument styles exactly) ──
export const PDF = {
  PAGE_HEIGHT: 841.89,        // A4 height in pt
  PADDING_TOP: 42,
  PADDING_BOTTOM: 30,
  HEADER_H: 33,               // PdfHeader rendered height (~32.5pt)
  PASSAGE_H: 55,              // TEXT ANALYSIS section reserve (tightened)

  // English line
  ENG_FONT: 9.5,
  ENG_LINE_H: 9.5 * 2.5,     // 23.75pt per line
  ENG_ROW_GAP: 6,             // marginBottom on sentenceRow

  // Translation rows
  TRANS_FONT: 6.5,
  TRANS_LINE_H: 6.5 * 1.8,   // 11.7pt — matches actual lineHeight: 1.8
  TRANS_ROW_GAP: 3,           // marginBottom: 3

  // Sentence block
  BLOCK_MARGIN: 14,           // marginBottom of sentenceContainer
  BLOCK_PADDING: 8,           // paddingBottom of sentenceContainer
  BLOCK_BORDER: 0.5,          // borderBottomWidth

  // Text width estimation (characters per line in the left column)
  ENG_CHARS_PER_LINE: 68,
  TRANS_CHARS_PER_LINE: 62,

  // Safety margin removed — react-pdf wrap={false} handles real overflow
  SAFETY: 0,

  // Packing factor — intentionally underestimate to maximise page fill
  PACKING: 0.92,
} as const;

const PAGE_USABLE = PDF.PAGE_HEIGHT - PDF.PADDING_TOP - PDF.PADDING_BOTTOM;

// ── Height estimation ───────────────────────────────────────

function estimateTransRowHeight(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / PDF.TRANS_CHARS_PER_LINE));
  return lines * PDF.TRANS_LINE_H + PDF.TRANS_ROW_GAP;
}

/**
 * Estimate the rendered height of a sentence block in points.
 * @param isLast  If true, omits separator (saves BLOCK_MARGIN + BLOCK_PADDING ≈ 22pt)
 */
export function estimateSentenceHeight(result: PaginationSentence, isLast: boolean): number {
  let h = 0;

  // English text line(s)
  const engText =
    result.englishChunks.length > 0
      ? result.englishChunks.map((c) => c.text).join(" / ")
      : result.original;
  const engLines = Math.max(1, Math.ceil(engText.length / PDF.ENG_CHARS_PER_LINE));
  h += engLines * PDF.ENG_LINE_H;
  h += PDF.ENG_ROW_GAP;

  // Translation rows
  if (result.englishChunks.length > 0) {
    if (!result.hideLiteral) {
      const litText = result.koreanLiteralChunks.map((c) => c.text).join(" / ");
      h += estimateTransRowHeight(litText);
    }
    if (!result.hideNatural) {
      h += estimateTransRowHeight(result.koreanNatural);
    }
    if (result.hongTNotes && !result.hideHongT) {
      h += estimateTransRowHeight(result.hongTNotes);
    }
    if (result.syntaxNotes) {
      for (const n of result.syntaxNotes) {
        const noteLines = n.content.split("\n").filter((l) => l.trim());
        for (const line of noteLines) {
          h += estimateTransRowHeight(line);
        }
      }
    }
  }

  // Separator (margin + padding + border) — omitted for last item
  if (!isLast) {
    h += PDF.BLOCK_MARGIN + PDF.BLOCK_PADDING + PDF.BLOCK_BORDER;
  }

  return h;
}

// ── Pagination ──────────────────────────────────────────────

export interface PaginationResult<T extends PaginationSentence> {
  pages: T[][];
  page1EndIndex: number;
  totalPages: number;
}

/**
 * Split sentences into pages.
 * Deterministic: same input → same output every time.
 */
export function paginateResults<T extends PaginationSentence>(results: T[]): PaginationResult<T> {
  if (results.length === 0) {
    return { pages: [], page1EndIndex: -1, totalPages: 0 };
  }

  const pages: T[][] = [];
  let currentPage: T[] = [];
  let usedHeight = 0;
  let isFirstPage = true;
  let page1EndIndex = -1;

  for (let i = 0; i < results.length; i++) {
    const isLastResult = i === results.length - 1;
    const hFull = estimateSentenceHeight(results[i], false);
    const hLast = estimateSentenceHeight(results[i], true);

    const pageCapacity =
      PAGE_USABLE - (isFirstPage ? PDF.HEADER_H : 0) - PDF.SAFETY;

    // Reserve passage space only for the very last sentence
    const passageReserve = isLastResult ? PDF.PASSAGE_H : 0;

    // Use hLast for the overflow check — if this is the last item on a page,
    // the separator won't render, saving ~22pt
    if (usedHeight + hLast > pageCapacity - passageReserve) {
      if (currentPage.length > 0) {
        if (isFirstPage) {
          page1EndIndex = pages.length === 0
            ? currentPage.length - 1
            : page1EndIndex;
        }
        pages.push(currentPage);
        currentPage = [];
        usedHeight = 0;
        isFirstPage = false;
      }
    }

    currentPage.push(results[i]);
    usedHeight += hFull;
  }

  if (currentPage.length > 0) {
    if (isFirstPage) {
      page1EndIndex = (pages.length === 0 ? 0 : pages[pages.length - 1].length) + currentPage.length - 1;
    }
    pages.push(currentPage);
  }

  // Compute page1EndIndex as global index
  if (pages.length > 0) {
    page1EndIndex = pages[0].length - 1;
  }

  return {
    pages,
    page1EndIndex,
    totalPages: pages.length,
  };
}
