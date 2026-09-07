export function cellWidth(input: string): number {
  let width = 0;

  for (const char of input) {
    width += isWide(char) ? 2 : 1;
  }

  return width;
}

export function padCells(input: string, width: number): string {
  return `${input}${" ".repeat(Math.max(0, width - cellWidth(input)))}`;
}

export function truncateCells(input: string, width: number, marker = "..."): string {
  if (cellWidth(input) <= width) {
    return input;
  }

  if (width <= 0) {
    return "";
  }
  const suffix = takeCells(marker, width);
  return `${takeCells(input, width - cellWidth(suffix))}${suffix}`;
}

function takeCells(input: string, width: number): string {
  let output = "";
  let used = 0;

  for (const char of input) {
    const charWidth = cellWidth(char);
    if (used + charWidth > width) {
      break;
    }

    output += char;
    used += charWidth;
  }

  return output;
}

export function wrapCells(input: string, width: number): string {
  return input
    .split("\n")
    .map((line) => wrapCellLine(line, width))
    .join("\n");
}

export function wrapWordsCells(input: string, width: number): string[] {
  if (cellWidth(input) <= width) {
    return [input];
  }

  const words = input.split(/(\s+)/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length === 0) {
      continue;
    }

    const candidate = `${current}${word}`;
    if (cellWidth(candidate) <= width) {
      current = candidate;
      continue;
    }

    if (current.trim().length > 0) {
      lines.push(current.trimEnd());
      const segments = wrapCells(word.trimStart(), width).split("\n");
      current = segments.pop() ?? "";
      lines.push(...segments);
      continue;
    }

    lines.push(...wrapCells(word, width).split("\n"));
    current = "";
  }

  if (current.trim().length > 0) {
    lines.push(current.trimEnd());
  }

  return lines.length > 0 ? lines : [input];
}

function wrapCellLine(line: string, width: number): string {
  if (cellWidth(line) <= width) {
    return line;
  }

  const output: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const char of line) {
    const charWidth = cellWidth(char);

    if (currentWidth > 0 && currentWidth + charWidth > width) {
      output.push(current);
      current = char;
      currentWidth = charWidth;
      continue;
    }

    current += char;
    currentWidth += charWidth;
  }

  output.push(current);
  return output.join("\n");
}

function isWide(char: string): boolean {
  return /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u.test(char);
}
