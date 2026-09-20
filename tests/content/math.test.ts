import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { decodeHTML } from "entities";
import { parsePhile } from "../../src/features/philes/content/frontmatter";
import { renderMathText } from "../../src/features/philes/rendering/math";

function formulas(html: string): string[] {
  return [...html.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)].map((match) =>
    decodeHTML(match[1] ?? "")
  );
}

test("every existing calculus expression renders without changing its TeX", () => {
  const { body } = parsePhile(readFileSync("src/content/philes/volume-1/mathematics/calculus-notes.phile", "utf8"));
  const expected = [...body.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$]*?)\$/g)].map((match) =>
    (match[1] ?? match[2] ?? "").trim()
  );
  assert.equal(expected.length, 220);
  const html = renderMathText(body);
  assert.deepEqual(formulas(html), expected);
  assert.equal((html.match(/class="phile-equation"/g) ?? []).length, 71);
});

test("inline and block code keep dollar signs and TeX literal", () => {
  const source = [
    "`$HOME/$PATH` and `` `$x$` ``",
    "```sh",
    'echo "$HOME"; echo "$PATH"',
    "```",
    "~~~tex",
    "$$\\frac{a}{b}$$",
    "~~~",
    "$x+1$"
  ].join("\n");
  const html = renderMathText(source);
  assert.deepEqual(formulas(html), ["x+1"]);
  assert.match(html, /\$HOME\/\$PATH/);
  assert.match(html, /\$\$\\frac\{a\}\{b\}\$\$/);
  assert.deepEqual(formulas(renderMathText("```sh\n$x$\n")), []);
});

test("escaped dollars, prices, and incomplete expressions stay literal", () => {
  for (const source of [String.raw`\$x\$`, "$5 and $10", "$9.99 or $19.99", "$unfinished", "$ echo $HOME"]) {
    assert.deepEqual(formulas(renderMathText(source)), [], source);
  }
  assert.deepEqual(formulas(renderMathText(String.raw`\$$x$`)), ["x"]);
});

test("TeX delimiters and multiline arrays preserve line breaks", () => {
  const source = String.raw`\(x^2\)

\[\frac{1}{2}\]

$
\begin{cases}x & x>0\\-x & x<0\end{cases}
$`;
  assert.deepEqual(formulas(renderMathText(source)), [
    "x^2",
    String.raw`\frac{1}{2}`,
    String.raw`\begin{cases}x & x>0\\-x & x<0\end{cases}`
  ]);
});

test("math prose retains ANSI formatting and escapes raw HTML", () => {
  const html = renderMathText("#[R;bold|red] $x$ <script>alert(1)</script>");
  assert.match(html, /ansi-bright-red ansi-bold/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/i);
  assert.deepEqual(formulas(html), ["x"]);
  assert.throws(() => renderMathText(String.raw`$\notARealCommand$`));
});
