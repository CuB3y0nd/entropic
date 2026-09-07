import { textHtml } from "../core/html";
import { cellWidth } from "../core/layout";
import { normalizeText, trimBlankLines } from "../core/text";

import { type AnsiToken, parseInlineAnsi, roleForMask } from "./tokens";

type RenderChunk = AnsiToken;

const inkBlockPattern = /^\s*--\[ ink \]--\s*$/;
const inkMaskPrefixPattern = /^~(.*)$/;
const inkTextPrefixPattern = /^\|(.*)$/;

export function renderAnsiText(input: string, width: number): string {
  return renderBlocks(trimBlankLines(normalizeText(input)), width).join("\n");
}

function renderBlocks(input: string, width: number): string[] {
  const lines = input.split("\n");
  const rendered: string[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined) break;
    if (!inkBlockPattern.test(line)) {
      const textLines: string[] = [];
      while (cursor < lines.length) {
        const current = lines[cursor];
        if (current === undefined || inkBlockPattern.test(current)) break;
        textLines.push(current);
        cursor += 1;
      }
      rendered.push(...renderPlainAnsiLines(textLines.join("\n"), width));
      continue;
    }
    const blockLines: string[] = [];
    cursor += 1;
    while (cursor < lines.length) {
      const current = lines[cursor];
      if (current === undefined || current.trim().length === 0) break;
      blockLines.push(current);
      cursor += 1;
    }
    rendered.push(...renderInkBlock(blockLines, width));
    if (cursor < lines.length) {
      rendered.push("");
      cursor += 1;
    }
  }
  return rendered;
}

function renderPlainAnsiLines(input: string, width: number): string[] {
  return renderWrappedChunks(parseInlineAnsi(input), width);
}

function renderInkBlock(lines: string[], width: number): string[] {
  const output: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined) break;
    const textMatch = line.match(inkTextPrefixPattern);
    const maskMatch = lines[cursor + 1]?.match(inkMaskPrefixPattern);

    if (textMatch && maskMatch) {
      output.push(...renderInkTextLine(textMatch[1] ?? "", maskMatch[1] ?? "", width));
      cursor += 2;
      continue;
    }

    if (line.match(inkMaskPrefixPattern)) {
      cursor += 1;
      continue;
    }

    output.push(...renderPlainAnsiLines(line, width));
    cursor += 1;
  }

  return output;
}

function renderInkTextLine(text: string, mask: string, width: number): string[] {
  const chunks: RenderChunk[] = [];
  let index = 0;

  for (const char of text) {
    const role = roleForMask(mask[index]);
    appendChunk(chunks, { text: char, roles: role ? [role] : undefined });
    index += 1;
  }

  return renderWrappedChunks(chunks, width);
}

function appendChunk(chunks: RenderChunk[], chunk: RenderChunk): void {
  const previous = chunks[chunks.length - 1];

  if (previous && sameRoles(previous.roles, chunk.roles)) {
    previous.text += chunk.text;
    return;
  }

  chunks.push(chunk);
}

function sameRoles(left: string[] | undefined, right: string[] | undefined): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((role, index) => role === right[index]);
}

function renderChunks(chunks: RenderChunk[]): string {
  return chunks
    .map((chunk) => {
      if (!chunk.roles) {
        return textHtml(chunk.text);
      }

      const classes = ["ansi", ...chunk.roles.map((role) => `ansi-${role}`)].join(" ");
      return `<span class="${classes}">${textHtml(chunk.text)}</span>`;
    })
    .join("");
}

function renderWrappedChunks(chunks: RenderChunk[], width: number): string[] {
  const output: string[] = [];
  let lineChunks: RenderChunk[] = [];
  let lineWidth = 0;

  for (const chunk of chunks) {
    for (const char of chunk.text) {
      if (char === "\n") {
        flushLine();
        continue;
      }
      const charWidth = cellWidth(char);

      if (lineWidth + charWidth > width && lineWidth > 0) {
        flushLine();
      }

      appendChunk(lineChunks, { text: char, roles: chunk.roles });
      lineWidth += charWidth;
    }
  }

  flushLine();
  return output;

  function flushLine(): void {
    output.push(renderChunks(lineChunks));
    lineChunks = [];
    lineWidth = 0;
  }
}
