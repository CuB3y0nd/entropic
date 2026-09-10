export const ARTICLE_TEXT = ".phile-body-pre:not(.phile-redacted-pre)";
export type ArticleSelection = { range: Range; text: string };
export type PreparedTool = { show: (signal: AbortSignal) => void | Promise<void> };

/** Tools own their content; the shared selection controller owns interaction. */
export type SelectionTool = {
  trigger: HTMLButtonElement;
  panel: HTMLElement;
  prepare: (selection: ArticleSelection) => PreparedTool | null | Promise<PreparedTool | null>;
};

export function articleBody(node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest(ARTICLE_TEXT) ?? null;
}
