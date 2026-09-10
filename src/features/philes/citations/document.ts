import { ARTICLE_TEXT } from "../selection/types";
import { type CitationMatch, createQuoteIndex } from "./quotes";

type TextEntry = { node: Text; start: number; end: number };

/** Index only article text; header art, controls and image metadata never enter a citation. */
export function createCitationDocument(article: HTMLElement) {
  const entries: TextEntry[] = [];
  const offsets = new Map<Node, number>();
  const parts: string[] = [];
  let length = 0;
  for (const body of article.querySelectorAll(ARTICLE_TEXT)) {
    if (parts.length) {
      parts.push("\n");
      length++;
    }
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      const node = current as Text;
      offsets.set(node, length);
      parts.push(node.data);
      entries.push({ node, start: length, end: length + node.length });
      length += node.length;
    }
  }
  const index = createQuoteIndex(parts.join(""));

  const boundary = (container: Node, offset: number): number => {
    const direct = offsets.get(container);
    if (direct !== undefined) return direct + offset;
    // Native selections may end on an element boundary rather than a text node.
    const point = document.createRange();
    point.setStart(container, offset);
    point.collapse(true);
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const entry = entries[mid];
      if (entry && point.comparePoint(entry.node, entry.node.length) < 0) low = mid + 1;
      else high = mid;
    }
    const entry = entries[low];
    return entry ? (point.comparePoint(entry.node, 0) >= 0 ? entry.start : entry.end) : length;
  };
  const at = (offset: number): TextEntry | undefined => {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const entry = entries[mid];
      if (entry && entry.end <= offset) low = mid + 1;
      else high = mid;
    }
    return entries[low];
  };

  return {
    fragment(range: Range): string | null {
      if (!range.startContainer.isConnected || !range.endContainer.isConnected) return null;
      return index.create(
        boundary(range.startContainer, range.startOffset),
        boundary(range.endContainer, range.endOffset)
      );
    },
    resolve(fragment: string): { status: "found"; range: Range } | Exclude<CitationMatch, { status: "found" }> | null {
      const result = index.resolve(fragment);
      if (result?.status !== "found") return result;
      const start = at(result.start);
      const end = at(result.end - 1);
      if (!start || !end || !start.node.isConnected || !end.node.isConnected) return { status: "missing" };
      const range = document.createRange();
      range.setStart(start.node, result.start - start.start);
      range.setEnd(end.node, result.end - end.start);
      return { status: "found", range };
    }
  };
}
