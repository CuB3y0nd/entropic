import temml from "temml";
import { escapeHtml } from "@/shared/textmode";
import { renderAnsiInline } from "@/shared/textmode/ansi";
import { type MathTree, resolveEquationReferences } from "./math-references";

type Part =
  | { kind: "text"; source: string }
  | { kind: "code"; source: string; block: boolean }
  | { kind: "math"; display: boolean; tree: MathTree };

/** Tokenize TeX before text layout can wrap its commands or unescape line breaks. */
export function renderMathText(source: string): string {
  return renderMathBlocks([source])[0] ?? "";
}

export function renderMathBlocks(sources: string[]): string[] {
  const blocks = sources.map((source) => splitMath(source.replace(/\r\n?/g, "\n")));
  resolveEquationReferences(
    blocks.flatMap((parts) => parts.flatMap((part) => (part.kind === "math" ? [part.tree] : [])))
  );
  return blocks.map(renderParts);
}

function renderParts(parts: Part[]): string {
  const blocks: string[] = [];
  let paragraph = "";
  let heading = false;
  const flush = () => {
    if (paragraph.trim()) {
      blocks.push(`<p class="phile-paragraph${heading ? " phile-heading" : ""}">${paragraph.trim()}</p>`);
    }
    paragraph = "";
    heading = false;
  };

  for (const part of parts) {
    if (part.kind === "code") {
      if (part.block) {
        flush();
        blocks.push(`<pre class="phile-code">${escapeHtml(part.source)}</pre>`);
      } else {
        paragraph += `<code>${escapeHtml(part.source)}</code>`;
      }
    } else if (part.kind === "text") {
      for (const text of part.source.split(/(\n[\t ]*\n)/)) {
        if (/^\n[\t ]*\n$/.test(text)) flush();
        else {
          if (!paragraph.trim()) heading = /^#{1,4} /.test(text.trimStart());
          paragraph += renderAnsiInline(text);
        }
      }
    } else {
      const html = part.tree.toMarkup();
      if (part.display) {
        flush();
        blocks.push(
          `<div class="phile-equation" tabindex="0" role="region" aria-label="Mathematical expression">${html}</div>`
        );
      } else {
        paragraph += `<span class="phile-math-inline">${html}</span>`;
      }
    }
  }
  flush();
  return blocks.join("\n");
}

function splitMath(source: string): Part[] {
  const parts: Part[] = [];
  let start = 0;
  const markers = /^[\t ]{0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)|(`+)|(\$\$?|\\[[(])|(\\(?:eqref|ref)\s*\{[^{}\n]*\})/gm;
  const append = (part: Part, cursor: number, end: number) => {
    if (cursor > start) parts.push({ kind: "text", source: source.slice(start, cursor) });
    parts.push(part);
    start = end;
    markers.lastIndex = end;
  };

  for (let match = markers.exec(source); match; match = markers.exec(source)) {
    const cursor = match.index;
    const [, fence, code, delimiter, reference] = match;
    if (fence) {
      const closing = new RegExp(`^[ \\t]{0,3}${fence[0]}{${fence.length},}[ \\t]*(?:\\n|$)`, "gm");
      closing.lastIndex = markers.lastIndex;
      const close = closing.exec(source);
      const end = close ? close.index + close[0].length : source.length;
      append({ kind: "code", source: source.slice(cursor, end), block: true }, cursor, end);
      continue;
    }

    if (escaped(source, cursor)) {
      markers.lastIndex = cursor + 1;
      continue;
    }
    if (code) {
      let end = source.indexOf(code, markers.lastIndex);
      while (end !== -1 && (source[end - 1] === "`" || source[end + code.length] === "`")) {
        end = source.indexOf(code, end + code.length);
      }
      if (end !== -1) {
        end += code.length;
        append({ kind: "code", source: source.slice(cursor, end), block: false }, cursor, end);
      }
      continue;
    }

    if (reference) {
      append(mathPart(reference, false), cursor, markers.lastIndex);
      continue;
    }
    if (!delimiter) continue;
    const inline = delimiter === "$" || delimiter === "\\(";
    if (delimiter === "$" && /[\t ]/.test(source[cursor + 1] ?? "")) continue;
    const closing = delimiter === "\\[" ? "\\]" : delimiter === "\\(" ? "\\)" : delimiter;
    let end = source.indexOf(closing, cursor + delimiter.length);
    while (end !== -1 && escaped(source, end)) end = source.indexOf(closing, end + closing.length);
    const value = end === -1 ? "" : source.slice(cursor + delimiter.length, end);
    if (
      !value.trim() ||
      (inline && /\n[\t ]*\n/.test(value)) ||
      (delimiter === "$" && /\d/.test(source[end + 1] ?? ""))
    ) {
      continue;
    }
    const after = end + closing.length;
    const beforeLine = source.slice(source.lastIndexOf("\n", cursor - 1) + 1, cursor);
    const nextLine = source.indexOf("\n", after);
    const afterLine = source.slice(after, nextLine === -1 ? source.length : nextLine);
    const standalone = !beforeLine.trim() && !afterLine.trim();
    const needsRoom = /\\(?:displaystyle|begin|frac|dfrac|int|sum|lim|sqrt)\b/.test(value);
    append(mathPart(value.trim(), !inline || (standalone && needsRoom)), cursor, after);
  }
  if (start < source.length) parts.push({ kind: "text", source: source.slice(start) });
  return parts;
}

function mathPart(source: string, display: boolean): Part {
  return {
    kind: "math",
    display,
    tree: temml.__renderToMathMLTree(source, {
      displayMode: display,
      annotate: true,
      xml: true,
      throwOnError: true,
      trust: false
    })
  };
}

function escaped(source: string, offset: number): boolean {
  let slashes = 0;
  for (let index = offset - 1; index >= 0 && source[index] === "\\"; index--) slashes++;
  return slashes % 2 === 1;
}
