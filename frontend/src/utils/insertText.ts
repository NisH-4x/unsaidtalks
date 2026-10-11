/**
 * Puts `insert` in place of the selected text (or at the caret). Returns the new text and the
 * caret position after the insert, or null when the result would be longer than `maxLength`.
 */
export function insertText(
  value: string,
  insert: string,
  selectionStart: number,
  selectionEnd: number,
  maxLength: number,
): { value: string; caret: number } | null {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const next = value.slice(0, start) + insert + value.slice(end);
  if (next.length > maxLength) return null;
  return { value: next, caret: start + insert.length };
}
