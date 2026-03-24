export interface SyntaxSelection {
  text: string;
  wordStart?: number;
  wordEnd?: number;
  contextBefore?: string;
  contextAfter?: string;
}
