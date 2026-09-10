import assert from "node:assert/strict";
import { test } from "node:test";
import { createQuoteIndex } from "../../src/features/philes/citations/quotes";

function link(source: string, quote: string, start = source.indexOf(quote)): string {
  const fragment = createQuoteIndex(source).create(start, start + quote.length);
  assert.ok(fragment, `Link for ${quote}`);
  return fragment;
}

function quoted(source: string, fragment: string): string {
  const match = createQuoteIndex(source).resolve(fragment);
  assert.equal(match?.status, "found");
  if (match?.status !== "found") throw new Error("Missing quote");
  return source.slice(match.start, match.end);
}

test("passage links survive insertions, hard wraps and indentation, including CJK", () => {
  const source = "Before\n    Read the bytes, then\n    check the boundary.\n字节顺序 matters.\nAfter";
  const fragment = link(source, "    Read the bytes, then\n    check the boundary.\n");
  assert.equal(new URLSearchParams(fragment.slice(1)).size, 1, "Unique text needs no context");
  const edited = "A newly inserted paragraph.\nBefore\nRead the\nbytes, then check the boundary.\n字节\n顺序 matters.";
  assert.equal(quoted(edited, fragment), "Read the\nbytes, then check the boundary.");
  assert.equal(quoted(edited, link(source, "字节顺序")), "字节\n顺序");
});

test("repeated text uses context and never falls back to an arbitrary occurrence", () => {
  const source = "first call: read(fd, buf, n);\nsecond call: read(fd, buf, n);\nend";
  const fragment = link(source, "read", source.lastIndexOf("read"));
  const match = createQuoteIndex(source).resolve(fragment);
  assert.deepEqual(match, { status: "found", start: source.lastIndexOf("read"), end: source.lastIndexOf("read") + 4 });
  assert.deepEqual(createQuoteIndex(source).resolve("#cite=read"), { status: "ambiguous" });
  assert.deepEqual(createQuoteIndex(`${source}\n${source}`).resolve(fragment), { status: "ambiguous" });
  assert.deepEqual(createQuoteIndex(source.replace("second call", "changed call")).resolve(fragment), {
    status: "missing"
  });
  const repeated = "x".repeat(1000);
  assert.equal(createQuoteIndex(repeated).create(400, 410), null, "No unique context within the limit");
});

test("code punctuation and Unicode round-trip, while letter case stays significant", () => {
  for (const quote of ["if (ptr != NULL) { *ptr = 0xff; }", "a+b & c#d ? x/y : 100%", "é e\u0301 🦊 字节"]) {
    const source = `prefix\n${quote}\nsuffix`;
    const fragment = link(source, quote);
    assert.equal(quoted(source, fragment), quote);
    assert.equal(quoted(source, new URL(`https://example.org/phile/${fragment}`).hash), quote);
  }
  assert.deepEqual(createQuoteIndex("null").resolve(link("NULL", "NULL")), { status: "missing" });
});

test("unrelated anchors, malformed fragments and oversized selections are bounded", () => {
  const index = createQuoteIndex("example");
  assert.equal(index.resolve("#chapter-1"), null);
  for (const fragment of [
    "#cite=",
    "#cite=%ZZ",
    "#cite=%ED%A0%80",
    "#cite=example&cite=other",
    "#cite=example&url=x",
    `#cite=${"x".repeat(12001)}`
  ]) {
    assert.deepEqual(index.resolve(fragment), { status: "invalid" });
  }
  assert.deepEqual(index.resolve("#cite=removed"), { status: "missing" });
  assert.equal(index.create(-1, 4), null);
  assert.equal(index.create(2, 1), null);
  assert.equal(createQuoteIndex("\n  \t").create(0, 4), null);
  assert.equal(createQuoteIndex("x".repeat(1025)).create(0, 1025), null);
});
