/**
 * Compute s/v labels for chunk segments within a single sentence.
 *
 * Rules:
 * - Main clause subject/verb → "s" / "v"
 * - Subordinate clause subject/verb → "s'" / "v'" (relative, adverbial, noun clauses)
 * - Parallel coordinated subjects/verbs in the SAME clause+role share a groupId.
 *   When ≥2 segments share the same (role, isSubordinate, groupId), label as
 *   v₁,v₂,… (or v₁',v₂',…). Single members render as plain "v"/"s".
 * - When groupId is undefined, each segment is treated as standalone.
 *
 * Returns a per-segment lookup keyed by `chunkIndex:segmentIndex`.
 */
import type { Chunk } from "@/lib/chunk-utils";

export interface SvLabel {
  /** Base letter: "s" or "v". */
  base: "s" | "v";
  /** Subscript number (e.g. 1, 2). undefined when the segment is not part of a parallel group. */
  index?: number;
  /** True for subordinate-clause label (renders trailing prime '). */
  prime: boolean;
}

export type SvLabelMap = Map<string, SvLabel>;

interface SegmentRef {
  ci: number;
  si: number;
  isVerb: boolean;
  isSubject: boolean;
  isSubordinate: boolean;
  groupId?: number;
}

function key(ci: number, si: number): string {
  return `${ci}:${si}`;
}

export function computeSvLabels(chunks: Chunk[]): SvLabelMap {
  const result: SvLabelMap = new Map();
  const refs: SegmentRef[] = [];

  chunks.forEach((c, ci) => {
    c.segments.forEach((seg, si) => {
      const isVerb = !!seg.isVerb;
      const isSubject = !!seg.isSubject;
      if (!isVerb && !isSubject) return;
      refs.push({
        ci,
        si,
        isVerb,
        isSubject,
        isSubordinate: !!seg.isSubordinate,
        groupId: seg.groupId,
      });
    });
  });

  // Bucket by (role, isSubordinate, groupId). Items without groupId get unique buckets.
  const buckets = new Map<string, SegmentRef[]>();
  let solo = 0;
  for (const r of refs) {
    const role = r.isVerb ? "v" : "s";
    const sub = r.isSubordinate ? "1" : "0";
    let bucketKey: string;
    if (r.groupId === undefined) {
      bucketKey = `${role}|${sub}|solo:${solo++}`;
    } else {
      bucketKey = `${role}|${sub}|g:${r.groupId}`;
    }
    const arr = buckets.get(bucketKey) ?? [];
    arr.push(r);
    buckets.set(bucketKey, arr);
  }

  for (const arr of buckets.values()) {
    if (arr.length === 0) continue;
    const first = arr[0];
    const base: "s" | "v" = first.isVerb ? "v" : "s";
    const prime = first.isSubordinate;
    if (arr.length === 1) {
      result.set(key(first.ci, first.si), { base, prime });
    } else {
      arr.forEach((r, idx) => {
        result.set(key(r.ci, r.si), { base, index: idx + 1, prime });
      });
    }
  }

  return result;
}

/** Render label as plain text fallback (e.g. "v₁'"). Used in tooltips/aria. */
export function svLabelToString(label: SvLabel): string {
  const subs = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
  const idxStr = label.index !== undefined ? subs[label.index] ?? String(label.index) : "";
  return `${label.base}${idxStr}${label.prime ? "'" : ""}`;
}
