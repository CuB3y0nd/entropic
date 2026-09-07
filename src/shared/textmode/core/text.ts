import { textHtml } from "./html";
import { cellWidth } from "./layout";

export type PreparedText = {
  text: string;
};

export function prepareText(input: string): PreparedText {
  return {
    text: trimBlankLines(normalizeText(input))
  };
}

export function renderPreparedText(input: PreparedText, width: number): string {
  return wrapText(input.text, width).map(textHtml).join("\n");
}

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[—–-]?[▸►]/gu, "->")
    .replace(/[◂◄][—–-]?/gu, "<-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ");
}

/** Strip the document's surrounding blank lines, never its first line's indentation. */
export function trimBlankLines(input: string): string {
  return input.replace(/^(?:[\t ]*\n)+|(?:\n[\t ]*)+$/g, "");
}

function wrapText(input: string, width: number): string[] {
  const lines = [""];
  let currentWidth = 0;

  for (const char of input) {
    if (char === "\n") {
      newLine();
      continue;
    }

    const charWidth = cellWidth(char);
    if (currentWidth + charWidth > width && currentWidth > 0) {
      newLine();
    }

    lines[lines.length - 1] += char;
    currentWidth += charWidth;
  }

  return lines;

  function newLine(): void {
    lines.push("");
    currentWidth = 0;
  }
}
