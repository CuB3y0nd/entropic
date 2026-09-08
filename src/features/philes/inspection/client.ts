import type { InspectionOptions, PreparedInspection } from "./inspect";
import { INSPECTION_LIMITS } from "./limits";
import { createInspectorPanel } from "./panel";

type Candidate = { range: Range; inspection: PreparedInspection };
let engine: Promise<typeof import("./inspect")> | null = null;

function bodyFor(node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest(".phile-body-pre:not(.phile-redacted-pre)") ?? null;
}

function sameRange(first: Range | null, second: Range): boolean {
  return (
    first?.startContainer === second.startContainer &&
    first.startOffset === second.startOffset &&
    first.endContainer === second.endContainer &&
    first.endOffset === second.endOffset
  );
}

function readSelection(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const body = bodyFor(range.startContainer);
  return body && body === bodyFor(range.endContainer) ? range : null;
}

export function installByteInspector(): void {
  const root = document.querySelector<HTMLElement>("[data-byte-inspector]");
  if (!root || root.dataset.installed) return;
  const trigger = root.querySelector<HTMLButtonElement>("[data-inspect-trigger]");
  const panel = root.querySelector<HTMLElement>("[data-inspect-panel]");
  if (!trigger || !panel) return;

  let candidate: Candidate | null = null;
  let dismissedRange: Range | null = null;
  let selectionTimer = 0;
  let selectionRevision = 0;
  let placementFrame = 0;
  let selecting = false;
  let options: InspectionOptions = {};

  const render = createInspectorPanel(panel, (key, value) => {
    if (!candidate) return;
    options[key] = value;
    render?.(candidate.inspection.render(options));
    if (!place(candidate.range)) hide();
  });
  if (!render) return;
  root.dataset.installed = "true";

  const hide = (): void => {
    selectionRevision++;
    window.clearTimeout(selectionTimer);
    window.cancelAnimationFrame(placementFrame);
    placementFrame = 0;
    if (candidate) dismissedRange = candidate.range;
    candidate = null;
    root.hidden = true;
    panel.hidden = true;
    trigger.hidden = false;
    trigger.setAttribute("aria-expanded", "false");
  };

  const place = (range: Range): boolean => {
    const rect = range.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
    const topEdge = (viewport?.offsetTop ?? 0) + 12;
    const rightEdge = leftEdge + Math.max(1, (viewport?.width ?? document.documentElement.clientWidth) - 24);
    const bottomEdge = topEdge + Math.max(1, (viewport?.height ?? window.innerHeight) - 24);
    if (rect.bottom < topEdge || rect.top > bottomEdge || rect.right < leftEdge || rect.left > rightEdge) return false;

    root.style.setProperty("--inspector-width", `${rightEdge - leftEdge}px`);
    root.style.setProperty("--inspector-height", `${bottomEdge - topEdge}px`);
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const below = rect.bottom + 8;
    const above = rect.top - height - 8;
    const top = below + height <= bottomEdge ? below : Math.max(topEdge, above);
    root.style.left = `${Math.max(leftEdge, Math.min(rect.left, rightEdge - width))}px`;
    root.style.top = `${Math.min(top, Math.max(topEdge, bottomEdge - height))}px`;
    return true;
  };

  const updateSelection = async (): Promise<void> => {
    if (selecting || (!panel.hidden && root.contains(document.activeElement))) return;
    const range = readSelection();
    if (!range) {
      if (panel.hidden) {
        hide();
        dismissedRange = null;
      }
      return;
    }
    if (sameRange(dismissedRange, range) || (candidate && sameRange(candidate.range, range))) return;
    const source = range.toString();
    hide();
    if (source.length > INSPECTION_LIMITS.selectionLength) return;
    const revision = selectionRevision;
    const savedRange = range.cloneRange();
    try {
      engine ??= import("./inspect");
      const { prepareInspection } = await engine;
      // A changed/dismissed selection must not reappear after the first lazy load.
      if (revision !== selectionRevision) return;
      const inspection = prepareInspection(source);
      if (!inspection) return;
      candidate = { range: savedRange, inspection };
      options = {};
      dismissedRange = null;
      root.hidden = false;
      if (!place(savedRange)) hide();
    } catch {
      engine = null;
      if (revision === selectionRevision) hide();
    }
  };

  const scheduleSelection = (): void => {
    selectionRevision++;
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(() => void updateSelection(), 160);
  };

  const open = (): void => {
    if (!candidate) return;
    render(candidate.inspection.render(options));
    trigger.hidden = true;
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    panel.scrollTop = 0;
    if (!place(candidate.range)) {
      hide();
      return;
    }
    panel.focus({ preventScroll: true });
  };

  const collapsePanel = (): void => {
    panel.hidden = true;
    trigger.hidden = false;
    trigger.setAttribute("aria-expanded", "false");
    if (candidate && place(candidate.range)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(candidate.range.cloneRange());
      trigger.focus({ preventScroll: true });
    } else hide();
  };

  const schedulePlacement = (): void => {
    if (root.hidden || placementFrame) return;
    placementFrame = window.requestAnimationFrame(() => {
      placementFrame = 0;
      if (candidate && !place(candidate.range)) hide();
    });
  };

  trigger.addEventListener("pointerdown", (event) => event.preventDefault());
  trigger.addEventListener("click", open);
  document.addEventListener("selectionchange", scheduleSelection);
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && root.contains(event.target)) return;
    selecting = true;
    hide();
    dismissedRange = null;
  });
  document.addEventListener("pointerup", () => {
    selecting = false;
    scheduleSelection();
  });
  document.addEventListener("pointercancel", () => {
    selecting = false;
    scheduleSelection();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.hidden) {
      event.preventDefault();
      if (panel.hidden) hide();
      else collapsePanel();
    }
  });
  document.addEventListener(
    "scroll",
    (event) => {
      if (!(event.target instanceof Node) || !root.contains(event.target)) hide();
    },
    true
  );
  window.addEventListener("resize", schedulePlacement);
  window.visualViewport?.addEventListener("resize", schedulePlacement);
  window.visualViewport?.addEventListener("scroll", schedulePlacement);
}
