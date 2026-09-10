import { articleBody } from "../selection/types";

type Line = { left: number; right: number; top: number; bottom: number };

/** Paint outside the text nodes so citation offsets and bitmap glyphs stay intact. */
export function createCitationMarker(article: HTMLElement, range: Range) {
  const sources: (Range | Element)[] = [];
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  // Article text is immutable. Resolve the quote once; only its geometry changes
  // as fonts and the responsive grid settle. Bitmap glyphs use their painted box.
  walker.currentNode = range.startContainer;
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (articleBody(node)) {
      const glyph = node.parentElement?.closest(".cjk-bitmap");
      if (glyph) sources.push(glyph);
      else {
        const part = document.createRange();
        part.setStart(node, node === range.startContainer ? range.startOffset : 0);
        part.setEnd(node, node === range.endContainer ? range.endOffset : (node.textContent?.length ?? 0));
        sources.push(part);
      }
    }
    if (node === range.endContainer) break;
  }
  const layer = document.createElement("div");
  layer.className = "fragment-marker";
  layer.setAttribute("aria-hidden", "true");
  article.append(layer);
  const strokes: HTMLSpanElement[] = [];

  return {
    update(): void {
      const origin = article.getBoundingClientRect();
      const zoom = Number.parseFloat(getComputedStyle(article).zoom) || 1;
      const rects = sources.flatMap((source) => Array.from(source.getClientRects()));
      rects.sort((a, b) => a.top - b.top || a.left - b.left);
      const lines: Line[] = [];
      for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= 0) continue;
        const line = lines.at(-1);
        const overlap = line ? Math.min(line.bottom, rect.bottom) - Math.max(line.top, rect.top) : 0;
        if (line && overlap > Math.min(line.bottom - line.top, rect.height) / 2) {
          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
          line.top = Math.min(line.top, rect.top);
          line.bottom = Math.max(line.bottom, rect.bottom);
        } else lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
      }
      // Batch layout reads before writing; ANSI/CJK spans share one stroke per line.
      for (const [index, line] of lines.entries()) {
        let stroke = strokes[index];
        if (!stroke) {
          stroke = document.createElement("span");
          stroke.className = "fragment-marker-line";
          strokes.push(stroke);
          layer.append(stroke);
        }
        // Range rectangles include CSS zoom; positioned children use local units.
        stroke.style.left = `${(line.left - origin.left) / zoom}px`;
        stroke.style.top = `${(line.top - origin.top) / zoom}px`;
        stroke.style.width = `${(line.right - line.left) / zoom}px`;
        stroke.style.height = `${(line.bottom - line.top) / zoom}px`;
      }
      for (const stroke of strokes.splice(lines.length)) stroke.remove();
    },
    remove(): void {
      layer.remove();
    }
  };
}
