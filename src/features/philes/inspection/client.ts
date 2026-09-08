import { type Inspection, type InspectionOptions, inspectSelection } from "./inspect";

type Candidate = { range: Range; source: string; inspection: Inspection };

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
  const source = selection.toString();
  const inspection = inspectSelection(source);
  return inspection ? { range: range.cloneRange(), source, inspection } : null;
}

export function installByteInspector(): void {
  const root = document.querySelector<HTMLElement>("[data-byte-inspector]");
  if (!root || root.dataset.installed) return;
  const trigger = root.querySelector<HTMLButtonElement>("[data-inspect-trigger]");
  const panel = root.querySelector<HTMLElement>("[data-inspect-panel]");
  const kind = root.querySelector<HTMLElement>("[data-inspect-kind]");
  const rows = root.querySelector<HTMLElement>("[data-inspect-rows]");
  const note = root.querySelector<HTMLElement>("[data-inspect-note]");
  const controls = root.querySelector<HTMLElement>("[data-inspect-controls]");
  if (!trigger || !panel || !kind || !rows || !note || !controls) return;
  root.dataset.installed = "true";

  let candidate: Candidate | null = null;
  let dismissedRange: Range | null = null;
  let selectionTimer = 0;
  let selecting = false;
  let options: InspectionOptions = {};

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
    options = {};
    dismissedRange = null;
    root.hidden = false;
    if (!place(next.range)) hide();
  };

  const scheduleSelection = (): void => {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(updateSelection, 160);
  };

  const render = (inspection: Inspection): void => {
    kind.textContent = `/ ${inspection.title}`;
    controls.replaceChildren();
    controls.hidden = inspection.controls.length === 0;
    for (const setting of inspection.controls) {
      const label = document.createElement("label");
      const caption = document.createElement("span");
      caption.textContent = setting.label;
      const select = document.createElement("select");
      select.dataset.inspectControl = setting.key;
      select.setAttribute(
        "aria-label",
        setting.label === "ORDER" ? "Byte order" : setting.label === "BITS" ? "Bit width" : "View"
      );
      for (const entry of setting.choices) {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        select.append(option);
      }
      select.value = setting.value;
      select.addEventListener("change", () => {
        if (!candidate) return;
        options[setting.key] = select.value;
        const next = inspectSelection(candidate.source, options);
        if (!next) return;
        candidate.inspection = next;
        render(next);
        if (!place(candidate.range)) hide();
        else
          controls
            .querySelector<HTMLSelectElement>(`[data-inspect-control="${setting.key}"]`)
            ?.focus({ preventScroll: true });
      });
      label.append(caption, select);
      controls.append(label);
    }
    rows.replaceChildren();
    for (const result of inspection.rows) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "byte-inspector-row";
      button.setAttribute("aria-label", `Select ${result.label}: ${result.value}`);
      const label = document.createElement("span");
      label.className = "byte-inspector-label";
      label.textContent = result.label;
      const value = document.createElement("span");
      value.className = "byte-inspector-value";
      value.textContent = result.value;
      button.append(label, value);
      button.addEventListener("click", () => {
        const range = document.createRange();
        range.selectNodeContents(value);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
      rows.append(button);
    }
    note.textContent = inspection.note;
    note.hidden = !inspection.note;
  };

  const open = (): void => {
    if (!candidate) return;
    render(candidate.inspection);
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
