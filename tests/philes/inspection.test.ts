import assert from "node:assert/strict";
import test from "node:test";
import { inspectSelection } from "../../src/features/philes/inspection/inspect";

function values(source: string): Record<string, string> {
  const inspection = inspectSelection(source);
  assert.ok(inspection, `Expected inspectable input: ${source}`);
  return Object.fromEntries(inspection.rows.map((row) => [row.label, row.value]));
}

test("integer views preserve exact large addresses and normalize prefixes", () => {
  assert.deepEqual(values("  0X1000  "), { DEC: "4096", HEX: "0x1000", BIN: "0b1000000000000" });
  assert.equal(values("18446744073709551615").HEX, "0xffffffffffffffff");
  assert.equal(values("0xffffffffffffffff").DEC, "18446744073709551615");
  assert.equal(values("9007199254740993").HEX, "0x20000000000001");
  assert.equal(values("+0b1000000000000").DEC, "4096");
  assert.equal(values("004096").DEC, "4096");
});

test("negative integers use a sign, not an assumed two's-complement width", () => {
  assert.deepEqual(values("-0x10"), { DEC: "-16", HEX: "-0x10", BIN: "-0b10000" });
  assert.deepEqual(values("-0"), { DEC: "0", HEX: "0x0", BIN: "0b0" });
});

test("bytes retain zeros and expose unsigned endian interpretations", () => {
  assert.deepEqual(values("00 02 00 00"), { HEX: "00 02 00 00", ASCII: "....", "UINT LE": "512", "UINT BE": "131072" });
  assert.equal(values("ff ff ff ff ff ff ff ff")["UINT LE"], "18446744073709551615");
  assert.equal(values("45 58 53 32 37").ASCII, "EXS27");
  assert.equal(values("20 7e 7f 00").ASCII, " ~..");
  assert.equal(values("41\n42\t43").ASCII, "ABC");
});

test("escaped and prefixed byte strings have the same interpretation", () => {
  assert.deepEqual(values(String.raw`\x41\x42\x00`), values("41 42 00"));
  assert.deepEqual(values("0x41 0X42 0x00"), values("41 42 00"));
  assert.deepEqual(values(String.raw`\x00`), { HEX: "00", ASCII: ".", "UINT LE": "0", "UINT BE": "0" });
  assert.equal(inspectSelection("41")?.kind, "integer");
  assert.equal(inspectSelection("0x41")?.kind, "integer");
});

test("long byte strings keep ASCII but do not imply a machine integer width", () => {
  const source = Array(32).fill("41").join(" ");
  assert.deepEqual(values(source), { HEX: source, ASCII: "A".repeat(32) });
  assert.equal(inspectSelection(`${source} 41`), null);
  assert.equal(values(`0x${"f".repeat(64)}`).DEC, ((1n << 256n) - 1n).toString());
  assert.equal(inspectSelection(`0x1${"0".repeat(64)}`), null);
});

test("prose, expressions, ambiguous or incomplete data do not activate the inspector", () => {
  for (const source of [
    "",
    " ",
    "deadbeef",
    "version 12",
    "0x10 + 4",
    "0x",
    "0b2",
    "1.5",
    "41 4",
    "0x41 42",
    "00000000: 41 42",
    String.raw`\xGG`,
    "1".repeat(513)
  ]) {
    assert.equal(inspectSelection(source), null, source);
  }
});
