import { articleBody, type SelectionTool } from "../selection/types";
import type { InspectionOptions, PreparedInspection } from "./inspect";
import { INSPECTION_LIMITS } from "./limits";
import { createInspectorPanel } from "./panel";

let engine: Promise<typeof import("./inspect")> | null = null;

export function createInspectionTool(root: HTMLElement, onUpdate: () => void): SelectionTool | null {
  const trigger = root.querySelector<HTMLButtonElement>("[data-inspect-trigger]");
  const panel = root.querySelector<HTMLElement>("[data-inspect-panel]");
  if (!trigger || !panel) return null;
  let active: PreparedInspection | null = null;
  let options: InspectionOptions = {};
  const render = createInspectorPanel(panel, (key, value) => {
    if (!active) return;
    options[key] = value;
    render?.(active.render(options));
    onUpdate();
  });
  if (!render) return null;
  return {
    trigger,
    panel,
    async prepare({ range, text }) {
      if (
        text.length > INSPECTION_LIMITS.selectionLength ||
        articleBody(range.startContainer) !== articleBody(range.endContainer)
      )
        return null;
      try {
        engine ??= import("./inspect");
        const { prepareInspection } = await engine;
        const inspection = prepareInspection(text);
        if (!inspection) return null;
        const previous: InspectionOptions = {};
        return {
          show() {
            active = inspection;
            options = previous;
            render(inspection.render(options));
          }
        };
      } catch {
        engine = null;
        return null;
      }
    }
  };
}
