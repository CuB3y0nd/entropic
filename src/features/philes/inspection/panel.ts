import type { Inspection, InspectionOptions } from "./inspect";

type Setting = { label: HTMLLabelElement; caption: HTMLSpanElement; select: HTMLSelectElement };

/** Keep native selects mounted while their value changes, including mobile pickers. */
export function createInspectorPanel(
  panel: HTMLElement,
  onChange: (key: keyof InspectionOptions, value: string) => void
): ((inspection: Inspection) => void) | null {
  const kind = panel.querySelector<HTMLElement>("[data-inspect-kind]");
  const rows = panel.querySelector<HTMLElement>("[data-inspect-rows]");
  const note = panel.querySelector<HTMLElement>("[data-inspect-note]");
  const controls = panel.querySelector<HTMLElement>("[data-inspect-controls]");
  if (!kind || !rows || !note || !controls) return null;
  const settings = new Map<keyof InspectionOptions, Setting>();

  controls.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const key = select.dataset.inspectControl;
    if (key !== "view" && key !== "width" && key !== "endian") return;
    panel.scrollTop = 0;
    onChange(key, select.value);
  });
  rows.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest(".byte-inspector-row") : null;
    const value = button?.querySelector(".byte-inspector-value");
    if (!value) return;
    const range = document.createRange();
    range.selectNodeContents(value);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });

  return (inspection) => {
    kind.textContent = `/ ${inspection.title}`;
    controls.hidden = inspection.controls.length === 0;
    for (const [key, setting] of settings) {
      setting.label.hidden = !inspection.controls.some((control) => control.key === key);
    }
    let previous: HTMLElement | null = null;
    for (const control of inspection.controls) {
      let setting = settings.get(control.key);
      if (!setting) {
        const label = document.createElement("label");
        const caption = document.createElement("span");
        const select = document.createElement("select");
        select.dataset.inspectControl = control.key;
        select.setAttribute(
          "aria-label",
          control.key === "endian" ? "Byte order" : control.key === "width" ? "Bit width" : "View"
        );
        label.append(caption, select);
        controls.append(label);
        setting = { label, caption, select };
        settings.set(control.key, setting);
      }
      const { label, caption, select } = setting;
      // Match keyboard order to visual order. Value-only updates never move a select.
      const next: Element | null = previous ? previous.nextElementSibling : controls.firstElementChild;
      if (next !== label) controls.insertBefore(label, next);
      previous = label;
      caption.textContent = control.label;
      const choicesChanged =
        select.options.length !== control.choices.length ||
        control.choices.some(
          (entry, index) => select.options[index]?.value !== entry.value || select.options[index]?.label !== entry.label
        );
      if (choicesChanged) {
        select.replaceChildren(...control.choices.map((entry) => new Option(entry.label, entry.value)));
      }
      select.value = control.value;
    }
    const fragment = document.createDocumentFragment();
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
      fragment.append(button);
    }
    rows.replaceChildren(fragment);
    note.textContent = inspection.note;
    note.hidden = !inspection.note;
  };
}
