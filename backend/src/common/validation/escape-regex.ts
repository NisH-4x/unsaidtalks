/** Makes user input safe to embed in a regular expression (prevents regex injection). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
