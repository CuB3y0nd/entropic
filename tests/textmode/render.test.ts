import assert from "node:assert/strict";
import { test } from "node:test";
import { renderAnsiText } from "../../src/shared/textmode/ansi/render";
import { externalLink, link } from "../../src/shared/textmode/core/html";
import { cellWidth, truncateCells, wrapWordsCells } from "../../src/shared/textmode/core/layout";

test("a long word after a short word respects the available cell width", () => {
  const lines = wrapWordsCells("a verylongidentifier", 5);
  assert.ok(
    lines.every((line) => cellWidth(line) <= 5),
    JSON.stringify(lines)
  );
  assert.equal(lines.join("").replaceAll(" ", ""), "averylongidentifier");
});

test("a truncation marker fits even in a narrow column", () => {
  for (const width of [0, 1, 2, 3, 4]) {
    assert.ok(cellWidth(truncateCells("long title", width)) <= width);
  }
});

test("plain code retains Windows paths and first-line indentation", () => {
  assert.equal(renderAnsiText(String.raw`C:\Users\name\file`, 80), String.raw`C:\Users\name\file`);
  assert.equal(renderAnsiText("\n    code\n", 80), "    code");
});

test("ANSI markers escape only syntax and preserve combined styles", () => {
  assert.equal(renderAnsiText(String.raw`\#[R|literal]`, 80), "#[R|literal]");
  assert.equal(
    renderAnsiText("#[R;bold|<text>]", 80),
    '<span class="ansi ansi-bright-red ansi-bold">&lt;text&gt;</span>'
  );
});

test("HTML links reject executable URL schemes without rejecting ordinary URLs", () => {
  for (const render of [link, externalLink]) {
    for (const href of ["javascript:alert(1)", "data:text/html,hello", "java\nscript:alert(1)"]) {
      assert.throws(() => render(href, "link"));
    }
    assert.match(render("https://example.org/?a=1&b=2", "<label>"), /&lt;label&gt;/);
    assert.match(render("/volume/0/", "volume"), /href="\/volume\/0\/"/);
  }
});
