export type PassageCompletionState = {
  syntaxCompleted?: boolean;
  syntaxCompletedAt?: string | null;
  previewCompleted?: boolean;
  previewCompletedAt?: string | null;
};

export type PassagePreviewSnapshot = {
  passage?: string;
  pdfTitle?: string;
  vocab?: unknown[];
  synonyms?: unknown[];
  summary?: string;
  examBlock?: unknown;
};

export type PassageStorePayload = {
  syntaxResults?: unknown[];
  preview?: PassagePreviewSnapshot;
  completion?: PassageCompletionState;
};

export function parsePassageStore(raw: unknown): PassageStorePayload {
  if (Array.isArray(raw)) {
    return { syntaxResults: raw };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      syntaxResults: Array.isArray(obj.syntaxResults) ? obj.syntaxResults : undefined,
      preview: obj.preview && typeof obj.preview === "object" ? (obj.preview as PassagePreviewSnapshot) : undefined,
      completion: obj.completion && typeof obj.completion === "object" ? (obj.completion as PassageCompletionState) : undefined,
    };
  }
  return {};
}

export function mergePassageStore(
  baseRaw: unknown,
  patch: PassageStorePayload
): PassageStorePayload {
  const base = parsePassageStore(baseRaw);
  return {
    syntaxResults: patch.syntaxResults ?? base.syntaxResults,
    preview: { ...(base.preview || {}), ...(patch.preview || {}) },
    completion: { ...(base.completion || {}), ...(patch.completion || {}) },
  };
}
