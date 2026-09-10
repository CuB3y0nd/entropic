import { createCitationTool } from "../citations/client";
import { CITATION_LIMITS } from "../citations/limits";
import { createInspectionTool } from "../inspection/client";
import { articleBody, type PreparedTool, type SelectionTool } from "./types";

type Candidate = { range: Range; tools: Map<SelectionTool, PreparedTool>; lifetime: AbortController };

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
  const start = articleBody(range.startContainer);
  const end = articleBody(range.endContainer);
  return start && end && start.closest(".phile-wrap") === end.closest(".phile-wrap") ? range : null;
}

export function installSelectionTools(): void {
  const root = document.querySelector<HTMLElement>("[data-selection-tools]");
  const actions = root?.querySelector<HTMLElement>("[data-selection-actions]");
  if (!root || !actions || root.dataset.installed) return;
  let candidate: Candidate | null = null;
  let active: SelectionTool | null = null;
  let dismissedRange: Range | null = null;
  let selectionTimer = 0;
  let selectionRevision = 0;
  let openRevision = 0;
  let placementFrame = 0;
  let selecting = false;

  const tools = [
    createInspectionTool(root, () => {
      if (candidate && !place(candidate.range)) hide();
    }),
    createCitationTool(root)
  ].filter((tool): tool is SelectionTool => tool !== null);
  if (!tools.length) return;
  root.dataset.installed = "true";

  const hide = (): void => {
    selectionRevision++;
    openRevision++;
    clearTimeout(selectionTimer);
    cancelAnimationFrame(placementFrame);
    placementFrame = 0;
    if (candidate) dismissedRange = candidate.range;
    candidate?.lifetime.abort();
    candidate = null;
    active = null;
    if (root.hidden) return;
    root.hidden = true;
    actions.hidden = false;
    for (const { trigger, panel } of tools) {
      panel.hidden = true;
      trigger.hidden = true;
      trigger.removeAttribute("aria-busy");
      trigger.setAttribute("aria-expanded", "false");
    }
  };

  const place = (range: Range): boolean => {
    const rect = range.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
    const topEdge = (viewport?.offsetTop ?? 0) + 12;
    const rightEdge = leftEdge + Math.max(1, (viewport?.width ?? document.documentElement.clientWidth) - 24);
    const bottomEdge = topEdge + Math.max(1, (viewport?.height ?? innerHeight) - 24);
    if (rect.bottom < topEdge || rect.top > bottomEdge || rect.right < leftEdge || rect.left > rightEdge) return false;
    root.style.setProperty("--selection-width", `${rightEdge - leftEdge}px`);
    root.style.setProperty("--selection-height", `${bottomEdge - topEdge}px`);
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
    if (selecting || (active && root.contains(document.activeElement))) return;
    const range = readSelection();
    if (!range) {
      if (!active) {
        hide();
        dismissedRange = null;
      }
      return;
    }
    if (sameRange(dismissedRange, range) || (candidate && sameRange(candidate.range, range))) return;
    const text = range.toString();
    hide();
    if (text.length > CITATION_LIMITS.selection) return;
    const revision = selectionRevision;
    const savedRange = range.cloneRange();
    const prepared = await Promise.all(
      tools.map(async (tool) => ({ tool, view: await tool.prepare({ range: savedRange, text }) }))
    );
    if (revision !== selectionRevision) return;
    const available = new Map<SelectionTool, PreparedTool>();
    for (const { tool, view } of prepared) {
      tool.trigger.hidden = !view;
      if (view) available.set(tool, view);
    }
    if (!available.size) return;
    candidate = { range: savedRange, tools: available, lifetime: new AbortController() };
    dismissedRange = null;
    root.hidden = false;
    if (!place(savedRange)) hide();
  };

  const scheduleSelection = (): void => {
    selectionRevision++;
    clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(() => void updateSelection(), 160);
  };

  const open = async (tool: SelectionTool): Promise<void> => {
    const current = candidate;
    const view = current?.tools.get(tool);
    if (!current || !view || active) return;
    active = tool;
    const revision = ++openRevision;
    tool.trigger.setAttribute("aria-busy", "true");
    await view.show(current.lifetime.signal);
    if (candidate !== current || revision !== openRevision) return;
    tool.trigger.removeAttribute("aria-busy");
    tool.trigger.setAttribute("aria-expanded", "true");
    actions.hidden = true;
    tool.panel.hidden = false;
    tool.panel.scrollTop = 0;
    if (!place(current.range)) {
      hide();
      return;
    }
    tool.panel.focus({ preventScroll: true });
  };

  const collapsePanel = (): void => {
    const previous = active;
    if (!previous) return;
    openRevision++;
    previous.panel.hidden = true;
    previous.trigger.setAttribute("aria-expanded", "false");
    previous.trigger.removeAttribute("aria-busy");
    active = null;
    actions.hidden = false;
    if (candidate && place(candidate.range)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(candidate.range.cloneRange());
      previous.trigger.focus({ preventScroll: true });
    } else hide();
  };

  const schedulePlacement = (): void => {
    if (root.hidden || placementFrame) return;
    placementFrame = requestAnimationFrame(() => {
      placementFrame = 0;
      if (candidate && !place(candidate.range)) hide();
    });
  };
  for (const tool of tools) {
    tool.trigger.addEventListener("pointerdown", (event) => event.preventDefault());
    tool.trigger.addEventListener("click", () => void open(tool));
  }
  document.addEventListener("selectionchange", scheduleSelection);
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && root.contains(event.target)) return;
    selecting = true;
    hide();
    dismissedRange = null;
  });
  const finishSelection = (): void => {
    selecting = false;
    scheduleSelection();
  };
  document.addEventListener("pointerup", finishSelection);
  document.addEventListener("pointercancel", finishSelection);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.hidden) {
      event.preventDefault();
      if (active) collapsePanel();
      else hide();
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
