export type ByteInput = { bytes: number[]; address?: bigint };
export type Endian = "le" | "be";
const MAX_BYTES = 32;

function byteTokens(source: string, grouped = false): number[] | null {
  const tokens = source.trim().split(/\s+/);
  const pattern = grouped ? /^(?:[\da-f]{2}){1,2}$/i : /^(?:0x)?[\da-f]{2}$/i;
  if (!tokens.length || tokens.some((token) => !pattern.test(token))) return null;
  return tokens.flatMap((token) =>
    (token.replace(/^0x/i, "").match(/../g) ?? []).map((byte) => Number.parseInt(byte, 16))
  );
}

/** Only byte-oriented dumps: never guess the layout of debugger word values. */
export function parseBytes(source: string): ByteInput | null {
  let bytes: number[] | null = null;
  if (/^(?:[\da-f]{2}\s+)+[\da-f]{2}$/i.test(source) || /^(?:0x[\da-f]{2}\s+)+0x[\da-f]{2}$/i.test(source))
    bytes = byteTokens(source);
  const escaped = source.replace(/^"(.*)"$/, "$1");
  if (/^(?:\\x[\da-f]{2})+$/i.test(escaped))
    bytes = escaped
      .split(/\\x/i)
      .slice(1)
      .map((token) => Number.parseInt(token, 16));
  if (bytes) return bytes.length <= MAX_BYTES ? { bytes } : null;

  const lines = source.split(/\r?\n/);
  const result: number[] = [];
  let start: bigint | undefined;
  for (const line of lines) {
    // xxd, hexdump -C, GDB x/bx and pwndbg hexdump (offset + address).
    const match = line
      .trim()
      .match(/^(?:(?:\+?[\da-f]{4,16})\s+(?=0x))?(0x[\da-f]+|[\da-f]{4,16})(?:\s*<[^>]+>)?(:\s*|\s{2,})(.*)$/i);
    if (!match) return null;
    const address = BigInt(`0x${(match[1] ?? "").replace(/^0x/i, "")}`);
    const data = match[3] ?? "";
    // A byte column ends at an ASCII gutter, never at a hex-looking word there.
    const gutter = data.split(/[|│]/)[0] ?? "";
    const xxd = match[2]?.startsWith(":") && !/^0x/i.test(match[1] ?? "");
    const column = xxd ? (gutter.split(/\s{2,}/)[0] ?? "") : gutter;
    const row = byteTokens(column, xxd);
    if (!row?.length || result.length + row.length > MAX_BYTES) return null;
    if (start === undefined) start = address;
    if (address !== start + BigInt(result.length)) return null;
    result.push(...row);
  }
  return result.length ? { bytes: result, address: start } : null;
}

export function bytesInteger(bytes: number[], endian: Endian): bigint {
  const ordered = endian === "be" ? bytes : [...bytes].reverse();
  return ordered.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

export function integerBytes(value: bigint, width: number, endian: Endian): number[] {
  const bytes = Array.from({ length: width / 8 }, (_, index) => Number((value >> BigInt(index * 8)) & 255n));
  return endian === "le" ? bytes : bytes.reverse();
}

export function hexBytes(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}
export function asciiBytes(bytes: number[]): string {
  return bytes.map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".")).join("");
}

export function permissionText(value: bigint): string {
  const mode = Number(value & 0o7777n);
  const permissions = [0o400, 0o200, 0o100, 0o40, 0o20, 0o10, 0o4, 0o2, 0o1].map((mask, index) =>
    (mode & mask) !== 0 ? "rwx"[index % 3] : "-"
  );
  for (const [mask, index, letter] of [
    [0o4000, 2, "s"],
    [0o2000, 5, "s"],
    [0o1000, 8, "t"]
  ] as const) {
    if ((mode & mask) !== 0) permissions[index] = permissions[index] === "x" ? letter : letter.toUpperCase();
  }
  return permissions.join("");
}
