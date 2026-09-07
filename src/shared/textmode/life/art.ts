import { textHtml } from "../core/html";

export const lifeFrameWidth = 25;
export const lifeFrameHeight = 17;
export const lifeInnerWidth = lifeFrameWidth - 2;
export const lifeInnerHeight = lifeFrameHeight - 2;

export function lifeFrameHtml(): string {
  return lifeFrameLines()
    .map((line, row) => `<span data-life-line data-row="${row}">${textHtml(line)}</span>`)
    .join("\n");
}

export function lifeFrameLineHtml(row: number): string {
  return `<span data-life-line data-row="${row}">${textHtml(lifeFrameLines()[row] ?? "")}</span>`;
}

export function lifeFrameLines(): string[] {
  return [
    `┌${"─".repeat(lifeInnerWidth)}┐`,
    ...Array.from({ length: lifeInnerHeight }, () => `│${" ".repeat(lifeInnerWidth)}│`),
    `└${"─".repeat(lifeInnerWidth)}┘`
  ];
}
