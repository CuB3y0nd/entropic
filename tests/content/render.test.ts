import assert from "node:assert/strict";
import { test } from "node:test";
import type { Phile } from "../../src/features/philes";
import { parsePhile } from "../../src/features/philes/content/frontmatter";
import { routeForPhile } from "../../src/features/philes/data/routing";
import { renderPhile } from "../../src/features/philes/rendering";

function phile(body: string, redacted = false): Phile {
  const entry = {
    id: "volume-0/example.phile",
    collection: "philes" as const,
    body,
    data: { title: "Example", author: "Author", date: new Date("2026-01-01"), lang: "en" as const, redacted }
  };
  return { ...entry, route: routeForPhile(entry) };
}

test("frontmatter accepts BOM, CRLF, and a closing delimiter at EOF", () => {
  const result = parsePhile('\uFEFF---\r\ntitle: Example\r\n"redacted": TRUE\r\n---');
  assert.equal(result.data.redacted, true);
  assert.equal(result.body, "");
});

test("the rendering interface never includes redacted source or media", () => {
  const result = renderPhile(phile("private-body-canary\n![secret](/private.png)", true));
  assert.equal(result.body.kind, "redacted");
  assert.doesNotMatch(JSON.stringify(result), /private-body-canary|private\.png/);
});

test("HTML images decode attribute entities once and do not treat data-src as src", () => {
  const result = renderPhile(phile('<img data-src="/wrong.png" src="/right.png?a=1&amp;b=2" alt="A &amp; B">'));
  assert.equal(result.body.kind, "content");
  if (result.body.kind !== "content") throw new Error("Expected published body");
  const image = result.body.blocks.find((block) => block.kind === "image");
  assert.ok(image);
  assert.match(image.html, /src="\/right\.png\?a=1&amp;b=2"/);
  assert.match(image.html, /alt="A &amp; B"/);
  assert.doesNotMatch(image.html, /wrong\.png|amp;amp/);
  assert.throws(() => renderPhile(phile('<img src="jav&#x61;script:alert(1)">')));
});
