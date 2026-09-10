export const CITATION_LIMITS = {
  selection: 16384,
  quote: 1024,
  context: 64,
  fragment: 12000
} as const;

export function quoteText(source: string): string | null {
  if (source.length > CITATION_LIMITS.selection) return null;
  const text = source.replace(/\s+/gu, " ").trim();
  return text && text.length <= CITATION_LIMITS.quote && text.isWellFormed() ? text : null;
}
