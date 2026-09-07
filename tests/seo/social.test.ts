import assert from "node:assert/strict";
import { test } from "node:test";
import { twitterCardText } from "../../src/features/seo";

test("card text normalizes whitespace and keeps copy that fits, including redaction markers", () => {
  assert.equal(twitterCardText("  Research\n\tPhiles  ", "title"), "Research Philes");
  assert.equal(twitterCardText("x".repeat(70), "title"), "x".repeat(70));
  assert.equal(twitterCardText("x".repeat(200), "description"), "x".repeat(200));
  assert.equal(twitterCardText("[REDACTED]", "description"), "[REDACTED]");
});

test("card titles and descriptions reserve room for an ellipsis without splitting graphemes", () => {
  assert.equal(twitterCardText("x".repeat(71), "title"), `${"x".repeat(69)}…`);
  assert.equal(twitterCardText("文".repeat(201), "description"), `${"文".repeat(199)}…`);
  assert.equal(twitterCardText(`${"x".repeat(68)}e\u0301tail`, "title"), `${"x".repeat(68)}…`);
  assert.equal(twitterCardText(`${"x".repeat(65)}👩🏽‍💻tail`, "title"), `${"x".repeat(65)}…`);
});
