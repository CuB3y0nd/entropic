import { createTargetMarker } from "./target-marker";

export function installEquationHighlight(): void {
  const article = document.querySelector<HTMLElement>(".phile-math");
  if (!article?.querySelector(".phile-equation-row[id]")) return;

  let navigation = 0;
  let marker: ReturnType<typeof createTargetMarker> | null = null;
  let observer: ResizeObserver | null = null;
  const clear = (): void => {
    observer?.disconnect();
    observer = null;
    marker?.remove();
    marker = null;
  };

  const highlight = async (): Promise<void> => {
    const revision = ++navigation;
    clear();
    const row = document.getElementById(location.hash.slice(1));
    const equation = row?.closest<HTMLElement>(".phile-equation");
    if (!row?.matches(".phile-equation-row") || !equation) return;

    // Chromium restores the old scroll position during the load event. Wait
    // for that restoration before applying the fragment position ourselves.
    if (document.readyState !== "complete") {
      await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
    }
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (revision !== navigation) return;

    // Reload restores the reader's previous scroll position after native
    // fragment navigation. Reapply the vertical target once math layout is
    // stable, without changing a long equation's horizontal scroll position.
    const margin = Number.parseFloat(getComputedStyle(row).scrollMarginBlockStart) || 0;
    const delta = row.getBoundingClientRect().top - margin;
    if (Math.abs(delta) > 1) window.scrollBy(0, delta);

    const cells = [...row.children];
    // Measure cell contents, excluding the flexible space before the number.
    const parts = [cells.slice(0, -1).flatMap((cell) => [...cell.children]), [...(cells.at(-1)?.children ?? [])]];
    marker = createTargetMarker(
      equation,
      () =>
        parts.map((nodes) => {
          const rects = nodes.map((node) => node.getBoundingClientRect());
          return {
            left: Math.min(...rects.map((rect) => rect.left)),
            right: Math.max(...rects.map((rect) => rect.right)),
            top: Math.min(...rects.map((rect) => rect.top)),
            bottom: Math.max(...rects.map((rect) => rect.bottom))
          };
        }),
      clear
    );
    marker.update();
    if (!marker) return;
    observer = new ResizeObserver(() => marker?.update());
    observer.observe(equation);
  };

  window.addEventListener("hashchange", () => void highlight());
  article.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(".phile-equation-ref") : null;
    // Revisiting the same fragment does not emit hashchange.
    if (link?.hash === location.hash) void highlight();
  });
  void highlight();
}
