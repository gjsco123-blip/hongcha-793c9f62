/**
 * Shared PDF pagination constants & logic.
 * Used by both PdfDocument.tsx (actual PDF) and Index.tsx (preview page-break indicator).
 * Single source of truth — keeps UI preview and PDF output in perfect sync.
 *
 * KEY DESIGN: No packing/underestimation. Heights are estimated at 1:1 scale
 * with a small SAFETY margin to absorb rendering variance. This prevents
 * the manual pagination from disagreeing with react-pdf's actual layout.
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

  // English line
  ENG_FONT: 9.5,
  ENG_LINE_H: 9.5 * 2.5,     // 23.75pt per line
  ENG_ROW_GAP: 6,             // marginBottom on sentenceRow

  // Translation rows
  TRANS_FONT: 6.5,
  TRANS_LINE_H: 6.5 * 1.8,   // 11.7pt — matches actual lineHeight: 1.8
  TRANS_ROW_GAP: 3,           // marginBottom: 3

  // Sentence block separator (between blocks, NOT after last)
  BLOCK_MARGIN: 14,           // marginBottom of sentenceContainer
  BLOCK_PADDING: 8,           // paddingBottom of sentenceContainer
  BLOCK_BORDER: 0.5,          // borderBottomWidth
  // Total separator height = BLOCK_MARGIN + BLOCK_PADDING + BLOCK_BORDER = 22.5

  // Text width estimation (characters per line in the left column)
  ENG_CHARS_PER_LINE: 88,
  TRANS_CHARS_PER_LINE: 90,

  // TEXT ANALYSIS section
  PASSAGE_SECTION_MARGIN_TOP: 18,
  PASSAGE_TITLE_H: 10,        // title line + marginBottom
  PASSAGE_BOX_PADDING: 26,    // paddingTop(12) + paddingBottom(12) + border
  PASSAGE_LINE_H: 9 * 2,      // fontSize 9 * lineHeight 2
  PASSAGE_CHARS_PER_LINE: 103, // chars per line inside the passage box (full-width)

  // Safety margin — absorbs small rendering variances
  // Positive value = we leave this much unused space as buffer
  SAFETY: 15,
} as const;

// Separator height between sentence blocks
const SEPARATOR_H = PDF.BLOCK_MARGIN + PDF.BLOCK_PADDING + PDF.BLOCK_BORDER;

const PAGE_USABLE = PDF.PAGE_HEIGHT - PDF.PADDING_TOP - PDF.PADDING_BOTTOM;

// ── Height estimation ───────────────────────────────────────

function estimateTransRowHeight(text: string): number {
  const lines = Math.max(1, Math.ceil(text.length / PDF.TRANS_CHARS_PER_LINE));
  return lines * PDF.TRANS_LINE_H + PDF.TRANS_ROW_GAP;
}

/**
 * Estimate the "content-only" height of a sentence block (no separator).
 * Separator is handled separately in pagination logic.
 */
export function estimateSentenceContentHeight(result: PaginationSentence): number {
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

  return h;
}

/**
 * Legacy API — returns height including separator when !isLast.
 * No packing factor applied (1:1 estimation).
 */
export function estimateSentenceHeight(result: PaginationSentence, isLast: boolean): number {
  let h = estimateSentenceContentHeight(result);
  if (!isLast) {
    h += SEPARATOR_H;
  }
  return h;
}

// ── TEXT ANALYSIS section dynamic height ────────────────────

/**
 * Estimate the height of the TEXT ANALYSIS (스스로 분석) section
 * based on actual passage text length.
 */
export function estimatePassageHeight(results: PaginationSentence[]): number {
  // Build the full passage text: "1 sentence1 2 sentence2 ..."
  const fullText = results.map((r, i) => `${i + 1} ${r.original}`).join(" ");
  const lines = Math.max(1, Math.ceil(fullText.length / PDF.PASSAGE_CHARS_PER_LINE));

  return (
    PDF.PASSAGE_SECTION_MARGIN_TOP +
    PDF.PASSAGE_TITLE_H +
    PDF.PASSAGE_BOX_PADDING +
    lines * PDF.PASSAGE_LINE_H
  );
}

// ── Pagination ──────────────────────────────────────────────

export interface PaginationResult<T extends PaginationSentence> {
  pages: T[][];
  page1EndIndex: number;
  totalPages: number;
}

/**
 * Split sentences into pages.
 * Strategy: "fill current page first, overflow to next only when necessary."
 * No packing factor — heights are 1:1 with SAFETY buffer.
 */
export function paginateResults<T extends PaginationSentence>(results: T[]): PaginationResult<T> {
  if (results.length === 0) {
    return { pages: [], page1EndIndex: -1, totalPages: 0 };
  }

  const passageH = estimatePassageHeight(results);
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let usedHeight = 0;
  let isFirstPage = true;

  for (let i = 0; i < results.length; i++) {
    const isLastResult = i === results.length - 1;
    const contentH = estimateSentenceContentHeight(results[i]);

    // Available space on this page
    const pageCapacity =
      PAGE_USABLE -
      (isFirstPage ? PDF.HEADER_H : 0) -
      PDF.SAFETY;

    // If this is the last sentence, we also need room for TEXT ANALYSIS
    const passageReserve = isLastResult ? passageH : 0;

    // Height this item would add:
    // - If page already has items, we need a separator before this item
    // - Plus the content itself
    const separatorBefore = currentPage.length > 0 ? SEPARATOR_H : 0;
    const neededH = separatorBefore + contentH;

    // Check: does it fit?
    if (usedHeight + neededH + passageReserve > pageCapacity) {
      // Doesn't fit — push current page (if non-empty) and start new page
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
        usedHeight = 0;
        isFirstPage = false;

        // Recalculate for the new page (no separator needed for first item)
        const newPageCapacity = PAGE_USABLE - PDF.SAFETY;
        // On new page, this is the first item — no separator
        if (contentH + passageReserve > newPageCapacity) {
          // Single item doesn't fit on a whole page — force it anyway
          currentPage.push(results[i]);
          usedHeight = contentH;
        } else {
          currentPage.push(results[i]);
          usedHeight = contentH;
        }
      } else {
        // Page is empty but item still doesn't fit — force it (avoid infinite loop)
        currentPage.push(results[i]);
        usedHeight = contentH;
      }
    } else {
      // Fits — add to current page
      usedHeight += neededH;
      currentPage.push(results[i]);
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Compute page1EndIndex
  const page1EndIndex = pages.length > 0 ? pages[0].length - 1 : -1;

  return {
    pages,
    page1EndIndex,
    totalPages: pages.length,
  };
}
