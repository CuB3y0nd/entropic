import { type Inspection, inspectSelection } from "./inspect";

type Candidate = { range: Range; inspection: Inspection };

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

function readSelection(): Candidate | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const body = bodyFor(range.startContainer);
  if (!body || body !== bodyFor(range.endContainer)) return null;
  const inspection = inspectSelection(selection.toString());
  return inspection ? { range: range.cloneRange(), inspection } : null;
}

export function installByteInspector(): void {
  const root = document.querySelector<HTMLElement>("[data-byte-inspector]");
  if (!root || root.dataset.installed) return;
  const trigger = root.querySelector<HTMLButtonElement>("[data-inspect-trigger]");
  const panel = root.querySelector<HTMLElement>("[data-inspect-panel]");
  const close = root.querySelector<HTMLButtonElement>("[data-inspect-close]");
  const kind = root.querySelector<HTMLElement>("[data-inspect-kind]");
  const rows = root.querySelector<HTMLElement>("[data-inspect-rows]");
  const note = root.querySelector<HTMLElement>("[data-inspect-note]");
  const status = root.querySelector<HTMLElement>("[data-inspect-status]");
  if (!trigger || !panel || !close || !kind || !rows || !note || !status) return;
  root.dataset.installed = "true";

  let candidate: Candidate | null = null;
  let dismissedRange: Range | null = null;
  let selectionTimer = 0;
  let selecting = false;

  const hide = (): void => {
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
    const rightEdge = leftEdge + (viewport?.width ?? document.documentElement.clientWidth) - 24;
    const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 24;
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

  const updateSelection = (): void => {
    if (selecting || (!panel.hidden && root.contains(document.activeElement))) return;
    const next = readSelection();
    if (!next) {
      if (panel.hidden) {
        hide();
        dismissedRange = null;
      }
      return;
    }
    if (sameRange(dismissedRange, next.range)) return;
    if (candidate && sameRange(candidate.range, next.range)) return;
    hide();
    candidate = next;
    dismissedRange = null;
    root.hidden = false;
    if (!place(next.range)) hide();
  };

  const scheduleSelection = (): void => {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(updateSelection, 160);
  };

  const copyValue = async (button: HTMLButtonElement, value: string, label: string): Promise<void> => {
    const activeCandidate = candidate;
    try {
      await navigator.clipboard.writeText(value);
      if (candidate === activeCandidate && !panel.hidden) status.textContent = `${label} copied`;
    } catch {
      // Keep the result available for the browser's native Copy command.
      const valueNode = button.querySelector(".byte-inspector-value");
      if (!valueNode || candidate !== activeCandidate || panel.hidden) return;
      valueNode.textContent = value;
      const range = document.createRange();
      range.selectNodeContents(valueNode);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      status.textContent = "copy unavailable; use native Copy";
    }
  };

  const open = (): void => {
    if (!candidate) return;
    kind.textContent = `/ ${candidate.inspection.title}`;
    rows.replaceChildren();
    for (const result of candidate.inspection.rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "byte-inspector-row";
      button.setAttribute("aria-label", `Copy ${result.label}: ${result.copyValue}`);
      const label = document.createElement("span");
      label.className = "byte-inspector-label";
      label.textContent = result.label;
      const value = document.createElement("span");
      value.className = "byte-inspector-value";
      value.textContent = result.value;
      button.append(label, value);
      button.addEventListener("click", () => void copyValue(button, result.copyValue, result.label));
      rows.append(button);
    }
    note.textContent = candidate.inspection.note;
    note.hidden = !candidate.inspection.note;
    status.textContent = "click a value to copy";
    trigger.hidden = true;
    trigger.setAttribute("aria-expanded", "true");
    panel.hidden = false;
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

  trigger.addEventListener("pointerdown", (event) => event.preventDefault());
  trigger.addEventListener("click", open);
  close.addEventListener("click", collapsePanel);
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
  });
  document.addEventListener("keydown", (event) => {
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "KeyI") {
      const next = readSelection();
      if (!next) return;
      event.preventDefault();
      candidate = next;
      dismissedRange = null;
      root.hidden = false;
      open();
    }
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
  window.addEventListener("resize", () => hide());
  window.visualViewport?.addEventListener("resize", () => hide());
}
