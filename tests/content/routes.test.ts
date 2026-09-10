import assert from "node:assert/strict";
import { test } from "node:test";
import type { PhileEntry } from "../../src/features/philes";
import { routeForPhile } from "../../src/features/philes/data/routing";

function entry(slug?: string, id = "volume-0/example.phile"): PhileEntry {
  return {
    id,
    collection: "philes",
    data: { title: "Example", date: new Date("2026-01-01"), lang: "en", redacted: false, slug }
  };
}

test("routes encode a slug as one URL segment", () => {
  assert.equal(routeForPhile(entry("hello world")).href, "/volume/0/hello%20world/");
});

test("invalid paths cannot escape or alias another route", () => {
  for (const slug of ["..", "../outside", "a/b", "a\\b", "a?b", "a#b"]) {
    assert.throws(() => routeForPhile(entry(slug)), slug);
  }
  assert.throws(() => routeForPhile(entry(undefined, "volume-9007199254740993/example.phile")));
});
