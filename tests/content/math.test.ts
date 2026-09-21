import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { decodeHTML } from "entities";
import { parsePhile } from "../../src/features/philes/content/frontmatter";
import { renderMathBlocks, renderMathText } from "../../src/features/philes/rendering/math";

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

test("fenced code preserves TeX backslashes and literal markup when copied", () => {
  const source = [
    "```tex",
    String.raw`\[\begin{matrix} a & b \\ c & d \end{matrix}\]`,
    "x < y > z",
    "#[R|literal ink notation]",
    "```"
  ].join("\n");
  const html = renderMathText(source);
  const code = html.match(/^<pre class="phile-code">([\s\S]*)<\/pre>$/)?.[1];
  assert.ok(code);
  assert.equal(decodeHTML(code), source);
  assert.doesNotMatch(code, /<[^>]+>/);
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

test("equation references resolve forwards and backwards at build time", () => {
  const html = renderMathText(String.raw`See \eqref{energy} before its definition.

$$\begin{equation} E=mc^2 \label{energy}\end{equation}$$

Equation $\ref{energy}$ gives $E_{\text{from }\eqref{energy}}=mc^2$.`);
  assert.match(html, /id="equation-energy"/);
  assert.equal((html.match(/href="#equation-energy"/g) ?? []).length, 3);
  assert.match(html, /href="#equation-energy">\(1\)<\/a>/);
  assert.match(html, /href="#equation-energy">1<\/a>/);
  assert.match(html, /<mtext><a class="phile-equation-ref" href="#equation-energy">\(1\)<\/a><\/mtext>/);
  assert.match(html, /<mtext>\(1\)<\/mtext>/);
  assert.doesNotMatch(html, /class="tml-eqn"/);
});

test("numbering spans article blocks and resets for the next article", () => {
  const blocks = renderMathBlocks([
    String.raw`Forward \eqref{second}. $$\begin{equation}a=b\label{first}\end{equation}$$`,
    "",
    String.raw`$$\begin{equation}c=d\label{second}\end{equation}$$ Back \ref{first}.`
  ]);
  assert.match(blocks[0] ?? "", /href="#equation-second">\(2\)<\/a>/);
  assert.equal(blocks[1], "");
  assert.match(blocks[2] ?? "", /href="#equation-first">1<\/a>/);
  assert.match(
    renderMathText(String.raw`$$\begin{equation}a=b\label{first}\end{equation}$$ \ref{first}`),
    /href="#equation-first">1<\/a>/
  );
  assert.throws(() => renderMathText(String.raw`\eqref{first}`), /Unknown equation reference: first/);
});

test("aligned rows respect manual tags, notag, nonumber and starred environments", () => {
  const html = renderMathText(String.raw`$$
\begin{align}
a &= b \label{first} \\
c &= d \notag \\
e &= f \tag{A}\label{manual} \\
g &= h \nonumber \\
i &= j \label{second}
\end{align}
$$
$$\begin{equation*}x=y\end{equation*}$$
$$\begin{gather}u=v\label{third}\end{gather}$$
\eqref{first}, \ref{manual}, \eqref{second}, \eqref{third}.`);
  for (const [label, tag] of [
    ["first", "(1)"],
    ["manual", "A"],
    ["second", "(2)"],
    ["third", "(3)"]
  ]) {
    assert.ok(html.includes(`href="#equation-${label}">${tag}</a>`));
  }
  assert.equal((html.match(/phile-equation-row/g) ?? []).length, 4);
});

test("manual tag text is escaped and tag-star omits only the displayed parentheses", () => {
  const html = renderMathText(String.raw`$$x=y\tag*{A\&B}\label{custom}$$ \ref{custom}, \eqref{custom}`);
  assert.match(html, /class="tml-tag">A&amp;B<\/mtext>/);
  assert.match(html, /href="#equation-custom">A&amp;B<\/a>/);
  assert.match(html, /href="#equation-custom">\(A&amp;B\)<\/a>/);
});

test("multiple labels on one equation share a stable target", () => {
  const html = renderMathText(String.raw`$$x=y\tag{X}\label{one}\label{two}$$ \ref{one} \ref{two}`);
  assert.equal((html.match(/id="equation-one"/g) ?? []).length, 1);
  assert.equal((html.match(/href="#equation-one">X<\/a>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /equation-equation-/);
});

test("bad references and duplicate labels fail instead of publishing broken links", () => {
  assert.throws(() => renderMathText(String.raw`See \eqref{missing}.`), /Unknown equation reference: missing/);
  assert.throws(() => renderMathText(String.raw`$$x=y\label{plain}$$ \ref{plain}`), /Equation plain has no number/);
  assert.throws(
    () => renderMathBlocks([String.raw`$$x=y\tag{A}\label{same}$$`, String.raw`$$a=b\tag{B}\label{same}$$`]),
    /Duplicate equation label: same/
  );
});

test("reference examples in code and escaped references remain literal", () => {
  const source = [
    "`\\eqref{missing}`",
    "```tex",
    String.raw`$$x=y\tag{A}\label{demo}$$`,
    String.raw`\ref{demo}`,
    "```",
    String.raw`\\eqref{missing}`
  ].join("\n");
  const html = renderMathText(source);
  assert.doesNotMatch(html, /phile-equation-ref|phile-equation-row/);
  assert.match(html, /\\eqref\{missing\}/);
  assert.throws(() => renderMathText(`${source}\n\\ref{demo}`), /Unknown equation reference: demo/);
});
