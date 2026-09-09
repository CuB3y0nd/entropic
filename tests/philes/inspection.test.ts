import assert from "node:assert/strict";
import test from "node:test";
import { type InspectionOptions, prepareInspection } from "../../src/features/philes/inspection/inspect";

function inspectSelection(source: string, options?: InspectionOptions) {
  return prepareInspection(source)?.render(options) ?? null;
}

function values(source: string, options?: InspectionOptions): Record<string, string> {
  const inspection = inspectSelection(source, options);
  assert.ok(inspection, `Expected inspectable input: ${source}`);
  return Object.fromEntries(inspection.rows.map((row) => [row.label, row.value]));
}

test("exact integers, octal modes and fixed-width two's complement", () => {
  assert.equal(values("9007199254740993").HEX, "0x20000000000001");
  assert.equal(values("0xffffffffffffffff").DEC, "18446744073709551615");
  assert.equal(values("18446744073709551615").HEX, "0xffffffffffffffff");
  assert.equal(values("0X1000").DEC, "4096");
  assert.equal(values("0b1001").DEC, "9");
  assert.equal(values("0755").DEC, "493");
  assert.equal(values("0o755").MODE, "rwxr-xr-x");
  assert.equal(values("755").DEC, "755");
  assert.equal(values("755").MODE, undefined);
  for (const [source, mode] of [
    ["chmod 4755", "rwsr-xr-x"],
    ["mode 2644", "rw-r-Sr--"],
    ["01777", "rwxrwxrwt"],
    ["07000", "--S--S--T"]
  ] as const) {
    assert.equal(values(source).MODE, mode);
  }
  assert.equal(values("-1").HEX, "0xffffffff");
  assert.equal(values("-1", { width: "16" }).HEX, "0xffff");
  assert.equal(values("-1", { width: "16" }).UINT, "65535");
  assert.equal(values("-1", { width: "64" }).OCT, "0o1777777777777777777777");
  assert.equal(values("511", { width: "8" }).DEC, "-1");
  assert.match(inspectSelection("511", { width: "8" })?.note ?? "", /Low 8 bits; source 511/);
  assert.equal(values("(int8_t)0x80", { width: "64" }).HEX, "0xffffffffffffff80");
  assert.equal(values("(uint8_t)0x80", { width: "64" }).HEX, "0x80");
  for (const bits of [128, 256]) {
    const minimum = -(1n << BigInt(bits - 1));
    const result = values(minimum.toString());
    assert.equal(result.TYPE, `int${bits}_t / ${bits}`);
    assert.equal(result.HEX, `0x8${"0".repeat(bits / 4 - 1)}`);
  }
  const prepared = prepareInspection("-1");
  assert.ok(prepared);
  for (const width of ["8", "16", "64"]) prepared.render({ width, view: "bits" });
  assert.equal(prepared.render().rows.find((row) => row.label === "HEX")?.value, "0xffffffff");
});

test("CSAPP comparisons apply promotions and usual arithmetic conversions", () => {
  const cases = [
    ["0 == 0U", "unsigned int / 32"],
    ["-1 < 0", "int / 32"],
    ["-1 > 0U", "unsigned int / 32"],
    ["2147483647 > -2147483647-1", "int / 32"],
    ["2147483647U < -2147483647-1", "unsigned int / 32"],
    ["-1 > -2", "int / 32"],
    ["(unsigned)-1 > -2", "unsigned / 32"],
    ["2147483647 < 2147483648U", "unsigned int / 32"],
    ["2147483647 > (int)2147483648U", "int / 32"]
  ] as const;
  for (const [source, type] of cases) {
    const result = values(source);
    assert.equal(result.RESULT, "true", source);
    assert.equal(result.COMPARE, type, source);
  }
  assert.equal(values("-1 < 0U").LEFT, "4294967295");
  assert.equal(values("-1 < 0U").RESULT, "false");
  assert.equal(values("-1L < 0U").RESULT, "true");
  assert.equal(values("-1L < 0U").COMPARE, "long / 64");
  assert.equal(values("2147483648").TYPE, "long / 64");
  assert.equal(values("0x80000000").TYPE, "unsigned int / 32");
  assert.equal(values("~(uint8_t)0").DEC, "-1");
  assert.equal(values("(int)2147483648U").DEC, "-2147483648");
});

test("constant arithmetic, precedence, signed shifts and short circuiting", () => {
  for (const [source, expected] of [
    ["0x400123 - 0x400000", "291"],
    ["2 + 3 * 4", "14"],
    ["(2 + 3) * 4", "20"],
    ["-7 / 3", "-2"],
    ["-7 % 3", "-1"],
    ["-8 >> 2", "-2"],
    ["(0x91 & 0x80) != 0", "1"],
    ["0xff ^ 0x0f", "240"],
    ["1U << 31", "2147483648"],
    ["0xffffffffU + 1", "0"],
    ["0 && 1/0", "0"],
    ["1 || 1/0", "1"],
    ["0 ? 0U : -1", "4294967295"],
    ["1 ? 3 : 1/0", "3"],
    ["!(0 | 0)", "1"]
  ] as const)
    assert.equal(values(source).DEC, expected, source);
  for (const source of [
    "2147483647 + 1",
    "1 << 31",
    "1U << 32",
    "1 << -1",
    "-1 << 1",
    "1/0",
    "(-2147483647-1) % -1",
    "(int)1e40",
    "(int)NAN"
  ] as const) {
    assert.equal(inspectSelection(source)?.title, "UNDEFINED", source);
  }
});

test("C, assembler and decompiler spellings preserve width and helper semantics", () => {
  for (const [source, expected] of [
    ["18h", "24"],
    ["0FFh", "255"],
    ["0LL", "0"],
    ["42UL", "42"],
    ["42ULL", "42"],
    ["-1ui64", "18446744073709551615"],
    ["42i64", "42"],
    ["(__int64)-1", "-1"],
    ["(_BYTE)0x1234", "52"],
    ["(_WORD)0x123456", "13398"],
    ["(_DWORD)-1", "4294967295"],
    ["(size_t)-1", "18446744073709551615"],
    ["(bool)256", "1"],
    ["'A'", "65"],
    [String.raw`'\n'`, "10"],
    [String.raw`'\x41'`, "65"],
    [String.raw`'\101'`, "65"],
    [String.raw`'\\'`, "92"],
    [String.raw`'\''`, "39"],
    ["LOBYTE(0x12345678)", "120"],
    ["HIBYTE(0x12345678)", "18"],
    ["BYTE1(0x12345678)", "86"],
    ["SLOBYTE(0xff)", "-1"],
    ["SHIBYTE((uint16_t)0x8000)", "-128"],
    ["HIWORD(0x12345678)", "4660"],
    ["HIDWORD(0x123456789abcdef0ULL)", "305419896"],
    ["__PAIR16__(0x12, 0x34)", "4660"]
  ] as const)
    assert.equal(values(source).DEC, expected, source);
  assert.equal(values("__ROL1__(0x81, 1)").HEX, "0x3");
  assert.equal(values("__ROR4__(0x12345678, 8)").HEX, "0x78123456");
  assert.equal(values("__PAIR64__(0x12345678, 0x9abcdef0)").HEX, "0x123456789abcdef0");
  assert.equal(values("0x91", { view: "bits", width: "8" })["SET BITS"], "0, 4, 7");
  assert.equal(values("0x91", { view: "bits", width: "8" }).POPCNT, "3");
  assert.equal(values("0x91", { view: "bits", width: "8" })["HIGH 4"], "0x9");
});

test("floating literals round directly to IEEE precision, including ties and subnormals", () => {
  for (const [source, hex] of [
    ["0.1f", "0x3dcccccd"],
    ["11.28125f", "0x41348000"],
    ["0x1.8p+1", "0x4008000000000000"],
    ["-0.0f", "0x80000000"],
    ["1e-45f", "0x00000001"],
    ["0x1p-149f", "0x00000001"],
    ["0x1p-150f", "0x00000000"],
    ["0x1.000001p0f", "0x3f800000"],
    ["0x1.000003p0f", "0x3f800002"],
    ["1.000000059604644775390626f", "0x3f800001"],
    ["3.4028234663852886e38f", "0x7f7fffff"],
    ["3.4028236e38f", "0x7f800000"],
    ["7e-46f", "0x00000000"],
    ["8e-46f", "0x00000001"],
    ["2e-324", "0x0000000000000000"],
    ["3e-324", "0x0000000000000001"],
    ["1e400", "0x7ff0000000000000"],
    ["1e-400", "0x0000000000000000"]
  ] as const)
    assert.equal(values(source).HEX, hex, source);
  assert.equal(values("0.1f").VALUE, "0.10000000149011612");
  assert.equal(values("-0.0f").VALUE, "-0");
  assert.equal(values("1e-45f").CLASS, "+subnormal");
  assert.equal(values("NAN").VALUE, "NaN");
  assert.equal(values("(int)-3.9").DEC, "-3");
  assert.equal(values("1.0f + 0.5").TYPE, "float64");
  assert.equal(values("0.1", { view: "float32", endian: "be" }).BYTES, "3d cc cc cd");
  assert.equal(inspectSelection("1.0L")?.title, "UNSUPPORTED");
});

test("numeric casts and bit reinterpretations stay distinct", () => {
  assert.equal(values("(float)0x3f800000").VALUE, "1065353216");
  assert.equal(values("0x3f800000", { view: "float32" }).VALUE, "1");
  assert.equal(values("COERCE_FLOAT(0x3f800000)").VALUE, "1");
  assert.equal(values("COERCE_DOUBLE(0x3ff0000000000000ULL)").VALUE, "1");
  assert.equal(values("0x7f800001", { view: "float32" }).HEX, "0x7f800001");
  assert.equal(values("0x7f800001", { view: "float32" }).VALUE, "NaN");
});

test("bytes retain exact data and select width, endian, float and text interpretations", () => {
  assert.equal(values("00 02 00 00")["UINT LE"], "512");
  assert.equal(values("00 02 00 00")["UINT BE"], "131072");
  assert.equal(values("45 58 53 32 37").ASCII, "EXS27");
  assert.equal(values("20 7e 7f 00").ASCII, " ~..");
  assert.deepEqual(values(String.raw`\x41\x42\x00`), values("41 42 00"));
  assert.deepEqual(values("0x41 0X42 0x00"), values("41 42 00"));
  assert.equal(values("ff 7f", { view: "integer", endian: "be", width: "16" }).SINT, "-129");
  assert.equal(values("ff 7f", { view: "integer", endian: "le", width: "16" }).SINT, "32767");
  assert.equal(values("00 80 34 41", { view: "float32", endian: "le" }).VALUE, "11.28125");
  assert.equal(values("3f f0 00 00 00 00 00 00", { view: "float64", endian: "be" }).VALUE, "1");
  assert.equal(values("91 00", { view: "bits", width: "8" })["SET BITS"], "0, 4, 7");
  assert.equal(values("41 00 42 00", { view: "text" })["UTF-16"], '"AB"');
  assert.equal(values("00 41 00 42", { view: "text", endian: "be" })["UTF-16"], '"AB"');
  assert.equal(values("c3 a9", { view: "text" })["UTF-8"], '"é"');
  assert.equal(values("c3 28", { view: "text" })["UTF-8"], "invalid encoding");
  assert.equal(values("41 00 42", { view: "text" })["UTF-16"], "incomplete code unit");
});

test("byte dump parsing separates addresses and ASCII and requires contiguous rows", () => {
  const expected = values("7f 45 4c 46").HEX;
  for (const source of [
    "00000000: 7f45 4c46  .ELF",
    "00000000  7f 45 4c 46  |.ELF|",
    "0x400000 <header>: 0x7f 0x45 0x4c 0x46",
    "+0000 0x400000  7f 45 4c 46  │.ELF│"
  ] as const)
    assert.equal(values(source).HEX, expected, source);
  assert.equal(values("00000000: 4142  AB\n00000002: 4344  CD").ASCII, "ABCD");
  assert.equal(values("00000000: 4142  dead beef").ASCII, "AB");
  assert.equal(inspectSelection("00000000: 4142\n00000003: 4344"), null);
  assert.equal(inspectSelection("0x400000: 0x41424344"), null);
});

test("selection bounds and unsupported syntax never run code or allocate unbounded work", () => {
  const bytes = Array(32).fill("41").join(" ");
  assert.equal(values(bytes).ASCII, "A".repeat(32));
  assert.equal(values(`0x${"f".repeat(64)}`).DEC, ((1n << 256n) - 1n).toString());
  for (const source of [
    "",
    "deadbeef",
    "version 12",
    "0x",
    "0b2",
    "08",
    "41 4",
    "0x41 42",
    "foo(1)",
    "*(int*)0x400000",
    "$rsp + 8",
    "[rbp-18h]",
    "window.alert(1)",
    "1.0 % 2",
    `'${String.raw`\x00`.repeat(127)}`,
    `'${String.raw`\000`.repeat(127)}`,
    `${bytes} 41`,
    `0x1${"0".repeat(64)}`,
    "1".repeat(513),
    `${"(".repeat(40)}1${")".repeat(40)}`
  ] as const) {
    assert.equal(inspectSelection(source), null, source.slice(0, 80));
  }
});
