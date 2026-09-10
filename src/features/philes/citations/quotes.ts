import { CITATION_LIMITS, quoteText } from "./limits";

type Span = { text: number; source: number; length: number };
type Quote = { exact: string; prefix: string; suffix: string };
export type CitationMatch =
  | { status: "found"; start: number; end: number }
  | { status: "missing" | "ambiguous" | "invalid" };

const compact = (text: string): string => text.replace(/\s+/gu, "");

function decode(fragment: string): Quote | null {
  if (fragment.length > CITATION_LIMITS.fragment) return null;
  try {
    decodeURIComponent(fragment);
    const params = new URLSearchParams(fragment.slice(1));
    if ([...params.keys()].some((key) => !["cite", "prefix", "suffix"].includes(key))) return null;
    if (["cite", "prefix", "suffix"].some((key) => params.getAll(key).length > 1)) return null;
    const exact = quoteText(params.get("cite") ?? "");
    const prefix = params.get("prefix") ?? "";
    const suffix = params.get("suffix") ?? "";
    if (!exact || prefix.length > CITATION_LIMITS.context * 2 || suffix.length > CITATION_LIMITS.context * 2)
      return null;
    return { exact, prefix, suffix };
  } catch {
    return null;
  }
}

/** One immutable article index. Whitespace is layout, not an anchor: hard wraps,
 * indentation and CJK line breaks can change without moving a citation.
 * Text and context must match exactly otherwise; ambiguous matches never guess. */
export function createQuoteIndex(source: string): {
  create: (start: number, end: number) => string | null;
  resolve: (fragment: string) => CitationMatch | null;
} {
  const spans: Span[] = [];
  const parts: string[] = [];
  let length = 0;
  for (const match of source.matchAll(/\S+/gu)) {
    spans.push({ text: length, source: match.index, length: match[0].length });
    parts.push(match[0]);
    length += match[0].length;
  }
  const text = parts.join("");

  // Binary search over word runs, rather than a character-sized offset map.
  const spanAt = (position: number, coordinate: "source" | "text"): Span | undefined => {
    let low = 0;
    let high = spans.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const span = spans[mid];
      if (span && span[coordinate] + span.length <= position) low = mid + 1;
      else high = mid;
    }
    return spans[low];
  };
  const textOffset = (position: number): number => {
    const span = spanAt(position, "source");
    return span ? span.text + Math.max(0, position - span.source) : text.length;
  };
  const sourceOffset = (position: number): number => {
    const span = spanAt(position, "text");
    return span ? span.source + position - span.text : source.length;
  };
  const sourceEnd = (position: number): number => sourceOffset(position - 1) + 1;

  const locate = ({ exact, prefix, suffix }: Quote): CitationMatch => {
    const before = compact(prefix);
    const value = compact(exact);
    const needle = before + value + compact(suffix);
    const first = text.indexOf(needle);
    if (first === -1) return { status: "missing" };
    if (text.indexOf(needle, first + 1) !== -1) return { status: "ambiguous" };
    const start = first + before.length;
    return { status: "found", start: sourceOffset(start), end: sourceEnd(start + value.length) };
  };

  return {
    create(start, end) {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > source.length || end <= start)
        return null;
      const exact = quoteText(source.slice(start, end));
      if (!exact) return null;
      const from = textOffset(start);
      const to = textOffset(end);
      // Add context only when needed. Every candidate is round-tripped against
      // this document before a link can be offered to the reader.
      for (const context of [0, 16, 32, CITATION_LIMITS.context]) {
        const prefix = context ? (quoteText(source.slice(sourceOffset(Math.max(0, from - context)), start)) ?? "") : "";
        const suffix = context
          ? (quoteText(source.slice(end, sourceEnd(Math.min(text.length, to + context)))) ?? "")
          : "";
        if (prefix.length > CITATION_LIMITS.context * 2 || suffix.length > CITATION_LIMITS.context * 2) continue;
        const result = locate({ exact, prefix, suffix });
        if (result.status !== "found" || textOffset(result.start) !== from || textOffset(result.end) !== to) continue;
        const params = new URLSearchParams({ cite: exact });
        if (prefix) params.set("prefix", prefix);
        if (suffix) params.set("suffix", suffix);
        const fragment = `#${params}`;
        if (fragment.length <= CITATION_LIMITS.fragment) return fragment;
      }
      return null;
    },
    resolve(fragment) {
      if (!fragment.startsWith("#cite=")) return null;
      const quote = decode(fragment);
      return quote ? locate(quote) : { status: "invalid" };
    }
  };
}
