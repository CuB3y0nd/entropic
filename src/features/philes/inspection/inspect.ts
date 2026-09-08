export type InspectionRow = {
  label: string;
  value: string;
  copyValue: string;
};

export type Inspection = {
  kind: "integer" | "bytes";
  title: string;
  rows: InspectionRow[];
  note: string | null;
};

const MAX_SELECTION_LENGTH = 512;
const MAX_BYTES = 32;
const MAX_INTEGER = (1n << 256n) - 1n;

function row(label: string, value: string, copyValue = value): InspectionRow {
  return { label, value, copyValue };
}

function inspectInteger(source: string): Inspection | null {
  const negative = source.startsWith("-");
  const magnitude = BigInt(source.replace(/^[+-]/, ""));
  if (magnitude > MAX_INTEGER) return null;

  const sign = negative && magnitude !== 0n ? "-" : "";
  const binary = magnitude.toString(2);
  const groupedBinary = binary.replace(/\B(?=(?:[01]{4})+$)/g, " ");
  return {
    kind: "integer",
    title: "INTEGER",
    rows: [
      row("DEC", `${sign}${magnitude}`),
      row("HEX", `${sign}0x${magnitude.toString(16)}`),
      row("BIN", `${sign}0b${groupedBinary}`, `${sign}0b${binary}`)
    ],
    note: null
  };
}

function inspectBytes(tokens: string[]): Inspection | null {
  if (tokens.length > MAX_BYTES) return null;

  const bytes = tokens.map((token) => Number.parseInt(token, 16));
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
  const ascii = bytes.map((byte) => (byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".")).join("");
  const rows = [row("HEX", hex), row("ASCII", ascii)];
  const notes: string[] = [];

  if (bytes.length <= 8) {
    const bigEndian = bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
    const littleEndian = bytes.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n);
    rows.push(row("UINT LE", littleEndian.toString()), row("UINT BE", bigEndian.toString()));
  } else {
    notes.push("UINT views: up to 8 bytes.");
  }
  if (bytes.some((byte) => byte < 0x20 || byte > 0x7e)) notes.push("ASCII: . = non-printable byte.");

  return {
    kind: "bytes",
    title: `${bytes.length} ${bytes.length === 1 ? "BYTE" : "BYTES"}`,
    rows,
    note: notes.length ? notes.join(" ") : null
  };
}

/** Deliberately accepts data, never expressions or guesses at surrounding prose. */
export function inspectSelection(selection: string): Inspection | null {
  if (selection.length > MAX_SELECTION_LENGTH) return null;
  const source = selection.trim();

  if (/^[+-]?(?:0x[\da-f]+|0b[01]+|\d+)$/i.test(source)) return inspectInteger(source);
  if (/^(?:[\da-f]{2}\s+)+[\da-f]{2}$/i.test(source)) return inspectBytes(source.split(/\s+/));
  if (/^(?:0x[\da-f]{2}\s+)+0x[\da-f]{2}$/i.test(source)) {
    return inspectBytes(source.split(/\s+/).map((token) => token.slice(2)));
  }
  if (/^(?:\\x[\da-f]{2})+$/i.test(source)) return inspectBytes(source.split(/\\x/i).slice(1));
  return null;
}
