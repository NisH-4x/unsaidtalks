export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The words of a search, without the quote and minus signs that MongoDB search understands. */
export function searchTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((word) => word.replace(/^[-"]+|"+$/g, ''))
    .filter((word) => word.length > 1);
}
