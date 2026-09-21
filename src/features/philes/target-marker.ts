export type MarkerBox = { left: number; right: number; top: number; bottom: number };

/** Paint behind the content without changing text nodes or math rendering. */
export function createTargetMarker(container: HTMLElement, measure: () => MarkerBox[], onEnd: () => void) {
  const article = container.closest<HTMLElement>(".phile-wrap") ?? container;
  const layer = document.createElement("div");
  layer.className = "target-marker";
  layer.setAttribute("aria-hidden", "true");
  container.append(layer);
  const strokes: HTMLSpanElement[] = [];
  layer.addEventListener(
    "animationend",
    () => {
      if (layer.isConnected) onEnd();
    },
    { once: true }
  );

  return {
    update(): void {
      const origin = container.getBoundingClientRect();
      const zoom = Number.parseFloat(getComputedStyle(article).zoom) || 1;
      const boxes = measure().filter((box) => box.right > box.left && box.bottom > box.top);
      if (boxes.length === 0) {
        onEnd();
        return;
      }
      // Batch geometry reads before writing; scroll offsets keep math ink local.
      const left = container.scrollLeft - origin.left / zoom;
      const top = container.scrollTop - origin.top / zoom;
      for (const [index, box] of boxes.entries()) {
        let stroke = strokes[index];
        if (!stroke) {
          stroke = document.createElement("span");
          strokes.push(stroke);
          layer.append(stroke);
        }
        stroke.style.left = `${box.left / zoom + left}px`;
        stroke.style.top = `${box.top / zoom + top}px`;
        stroke.style.width = `${(box.right - box.left) / zoom}px`;
        stroke.style.height = `${(box.bottom - box.top) / zoom}px`;
      }
      for (const stroke of strokes.splice(boxes.length)) stroke.remove();
    },
    remove(): void {
      layer.remove();
    }
  };
}
