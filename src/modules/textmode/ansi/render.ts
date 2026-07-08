import { textHtml } from "../core/html";
import { cellWidth } from "../core/layout";
import { normalizeText } from "../core/text";

type AnsiToken = {
  text: string;
  role?: string;
};

type RenderChunk = {
  text: string;
  role?: string;
};

const ansiRoles = new Map<string, string>([
  ["k", "black"],
  ["black", "black"],
  ["r", "red"],
  ["red", "red"],
  ["g", "green"],
  ["green", "green"],
  ["y", "yellow"],
  ["yellow", "yellow"],
  ["b", "blue"],
  ["blue", "blue"],
  ["m", "magenta"],
  ["magenta", "magenta"],
  ["c", "cyan"],
  ["cyan", "cyan"],
  ["w", "white"],
  ["white", "white"],
  ["K", "bright-black"],
  ["br-black", "bright-black"],
  ["bright-black", "bright-black"],
  ["R", "bright-red"],
  ["br-red", "bright-red"],
  ["bright-red", "bright-red"],
  ["G", "bright-green"],
  ["br-green", "bright-green"],
  ["bright-green", "bright-green"],
  ["Y", "bright-yellow"],
  ["br-yellow", "bright-yellow"],
  ["bright-yellow", "bright-yellow"],
  ["B", "bright-blue"],
  ["br-blue", "bright-blue"],
  ["bright-blue", "bright-blue"],
  ["M", "bright-magenta"],
  ["br-magenta", "bright-magenta"],
  ["bright-magenta", "bright-magenta"],
  ["C", "bright-cyan"],
  ["br-cyan", "bright-cyan"],
  ["bright-cyan", "bright-cyan"],
  ["W", "bright-white"],
  ["br-white", "bright-white"],
  ["bright-white", "bright-white"],
  ["bold", "bold"],
  ["italic", "italic"],
  ["underline", "underline"],
  ["strike", "strike"]
]);

const inkBlockPattern = /^\s*--\[ ink \]--\s*$/;
const inkMaskPrefixPattern = /^~(.*)$/;
const inkTextPrefixPattern = /^\|(.*)$/;

export function renderAnsiText(input: string, width: number): string {
  return renderBlocks(normalizeText(input).trim(), width).join("\n");
}

function renderBlocks(input: string, width: number): string[] {
  const lines = input.split("\n");
  const rendered: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const match = lines[cursor].match(inkBlockPattern);

    if (!match) {
      const textLines: string[] = [];

      while (cursor < lines.length && !lines[cursor].match(inkBlockPattern)) {
        textLines.push(lines[cursor]);
        cursor += 1;
      }

      rendered.push(...renderPlainAnsiLines(textLines.join("\n"), width));
      continue;
    }

    const blockLines: string[] = [];
    cursor += 1;

    while (cursor < lines.length && lines[cursor].trim().length > 0) {
      blockLines.push(lines[cursor]);
      cursor += 1;
    }

    rendered.push(...renderInkBlock(blockLines, width));

    if (cursor < lines.length && lines[cursor].trim().length === 0) {
      rendered.push("");
      cursor += 1;
    }
  }

  return rendered;
}

function renderPlainAnsiLines(input: string, width: number): string[] {
  const output: string[] = [];
  let lineChunks: RenderChunk[] = [];
  let lineWidth = 0;

  for (const token of parseInlineAnsi(input)) {
    for (const char of token.text) {
      if (char === "\n") {
        flushLine();
        continue;
      }

      const charWidth = cellWidth(char);

      if (lineWidth + charWidth > width && lineWidth > 0) {
        flushLine();
      }

      appendChunk(lineChunks, { text: char, role: token.role });
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

function renderInkBlock(lines: string[], width: number): string[] {
  const output: string[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const textMatch = lines[cursor].match(inkTextPrefixPattern);
    const maskMatch = lines[cursor + 1]?.match(inkMaskPrefixPattern);

    if (textMatch && maskMatch) {
      output.push(...renderInkTextLine(textMatch[1] ?? "", maskMatch[1] ?? "", width));
      cursor += 2;
      continue;
    }

    if (lines[cursor].match(inkMaskPrefixPattern)) {
      cursor += 1;
      continue;
    }

    output.push(...renderPlainAnsiLines(lines[cursor], width));
    cursor += 1;
  }

  return output;
}

function renderInkTextLine(text: string, mask: string, width: number): string[] {
  const chunks: RenderChunk[] = [];
  let index = 0;

  for (const char of text) {
    const role = roleForMask(mask[index]);
    appendChunk(chunks, { text: char, role });
    index += 1;
  }

  return renderWrappedChunks(chunks, width);
}

function parseInlineAnsi(input: string): AnsiToken[] {
  const tokens: AnsiToken[] = [];
  let cursor = 0;
  let plain = "";

  while (cursor < input.length) {
    if (input[cursor] === "\\" && cursor + 1 < input.length) {
      plain += input[cursor + 1];
      cursor += 2;
      continue;
    }

    if (input.startsWith("#[", cursor)) {
      const parsed = parseMarker(input, cursor);

      if (parsed) {
        flushPlain();
        tokens.push({ text: parsed.text, role: parsed.role });
        cursor = parsed.end;
        continue;
      }
    }

    plain += input[cursor];
    cursor += 1;
  }

  flushPlain();
  return tokens;

  function flushPlain(): void {
    if (plain.length > 0) {
      tokens.push({ text: plain });
      plain = "";
    }
  }
}

function parseMarker(input: string, start: number): { role: string; text: string; end: number } | undefined {
  const pipe = findUnescaped(input, "|", start + 2);

  if (pipe === -1) {
    return undefined;
  }

  const close = findUnescaped(input, "]", pipe + 1);

  if (close === -1) {
    return undefined;
  }

  const aliases = input
    .slice(start + 2, pipe)
    .trim()
    .split(";");
  const roles: string[] = [];

  for (const alias of aliases) {
    const trimmedAlias = alias.trim();
    const role = ansiRoles.get(trimmedAlias);

    if (!role) {
      throw new Error(`Unknown ANSI role "${trimmedAlias}".`);
    }

    roles.push(role);
  }

  return {
    role: roles.join(" "), // Space-separated roles
    text: unescapeAnsiText(input.slice(pipe + 1, close)),
    end: close + 1
  };
}

function findUnescaped(input: string, needle: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === "\\" && index + 1 < input.length) {
      index += 1;
      continue;
    }

    if (input[index] === needle) {
      return index;
    }
  }

  return -1;
}

function unescapeAnsiText(input: string): string {
  return input.replace(/\\([#[\]|\\])/g, "$1");
}

function roleForMask(char: string | undefined): string | undefined {
  if (!char || char === "." || char === " ") {
    return undefined;
  }

  const role = ansiRoles.get(char);

  if (!role) {
    throw new Error(`Unknown ink mask "${char}".`);
  }

  return role;
}

function appendChunk(chunks: RenderChunk[], chunk: RenderChunk): void {
  const previous = chunks[chunks.length - 1];

  if (previous && previous.role === chunk.role) {
    previous.text += chunk.text;
    return;
  }

  chunks.push(chunk);
}

function renderChunks(chunks: RenderChunk[]): string {
  return chunks
    .map((chunk) => {
      if (!chunk.role) {
        return textHtml(chunk.text);
      }

      const classes = ["ansi", ...chunk.role.split(" ").map((r) => `ansi-${r}`)].join(" ");
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
      const charWidth = cellWidth(char);

      if (lineWidth + charWidth > width && lineWidth > 0) {
        flushLine();
      }

      appendChunk(lineChunks, { text: char, role: chunk.role });
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
