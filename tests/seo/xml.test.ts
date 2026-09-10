import assert from "node:assert/strict";
import { test } from "node:test";
import type { Phile } from "../../src/features/philes";
import { phileExcerpt, renderRss, renderSitemap } from "../../src/features/seo";

function phile(body: string, overrides: Partial<Phile["data"]> = {}, author = "Author"): Phile {
  return {
    id: "volume-0/example.phile",
    collection: "philes",
    body,
    credits: [{ name: author }],
    data: {
      title: "Example",
      date: new Date("2026-01-01"),
      lang: "en",
      redacted: false,
      ...overrides
    },
    route: {
      volume: 0,
      slug: "example",
      href: "/volume/0/example/",
      volumeHref: "/volume/0/",
      sourcePath: "volume-0/example.phile"
    }
  };
}

const site = new URL("https://example.com");
const feed = (philes: readonly Phile[]) => renderRss({ site, title: "A & B", description: "Notes", philes });

test("RSS represents author names with Dublin Core and preserves chronological order", () => {
  const older = phile("Older", { title: "Older" }, "A <B> & C");
  const newer = phile("Newer", { title: "Newer", date: new Date("2026-02-02") });
  const input = [older, newer];
  const xml = feed(input);
  assert.match(xml, /xmlns:dc="http:\/\/purl.org\/dc\/elements\/1.1\/"/);
  assert.match(xml, /<dc:creator>A &lt;B&gt; &amp; C<\/dc:creator>/);
  assert.doesNotMatch(xml, /<author>|<language>/);
  assert.ok(xml.indexOf("<title>Newer</title>") < xml.indexOf("<title>Older</title>"));
  assert.match(xml, /<lastBuildDate>Mon, 02 Feb 2026 00:00:00 GMT<\/lastBuildDate>/);
  assert.deepEqual(input, [older, newer]);
  assert.doesNotMatch(feed([]), /lastBuildDate|1970|<item>/);
});

test("RSS escapes markup and excludes characters forbidden by XML 1.0", () => {
  const xml = feed([phile("Text \u0000 end", { title: "<title>\u0001\ufffe\ud800 valid 🌱" })]);
  assert.match(xml, /&lt;title&gt; valid 🌱/);
  assert.ok(!xml.includes("\u0000"));
  assert.match(renderSitemap(site, [{ href: "/?a=1&b=2" }]), /a=1&amp;b=2/);
});

test("excerpts respect grapheme boundaries and include the ellipsis in the limit", () => {
  const text = "🌱👩🏽‍💻e\u0301中文 abcdefghijklmnop";
  assert.equal(phileExcerpt(phile(text), 8), "🌱👩🏽‍💻e\u0301中文...");
  assert.equal(phileExcerpt(phile("👩🏽‍💻🌱"), 2), "👩🏽‍💻🌱");
  assert.equal(phileExcerpt(phile("123456"), 2), "..");
  assert.equal(phileExcerpt(phile("private", { redacted: true })), "[REDACTED]");
  assert.throws(() => phileExcerpt(phile(text), 0), RangeError);
});
