import { type FloatWidth, literalFloat, ratioFloat } from "./float";

export type IntType = { name: string; bits: number; signed: boolean; rank: number };
export type Integer = { kind: "integer"; type: IntType; value: bigint };
export type Floating = { kind: "float"; width: FloatWidth; value: number };
export type Value = Integer | Floating;
export type CType = IntType | FloatWidth;

export class InspectionError extends Error {
  constructor(
    public readonly category: "undefined" | "unsupported" | "invalid",
    message: string
  ) {
    super(message);
  }
}

export const INT: IntType = { name: "int", bits: 32, signed: true, rank: 3 };
export const UINT: IntType = { ...INT, name: "unsigned int", signed: false };
const LONG: IntType = { name: "long", bits: 64, signed: true, rank: 4 };
const ULONG: IntType = { ...LONG, name: "unsigned long", signed: false };
const LL: IntType = { name: "long long", bits: 64, signed: true, rank: 5 };
const ULL: IntType = { ...LL, name: "unsigned long long", signed: false };

export function fixedType(bits: number, signed: boolean): IntType {
  return {
    name: `${signed ? "int" : "uint"}${bits}_t`,
    bits,
    signed,
    rank: bits < 32 ? (bits === 8 ? 1 : 2) : bits === 32 ? 3 : 4
  };
}

export function fits(value: bigint, type: IntType): boolean {
  return type.signed
    ? value >= -(1n << BigInt(type.bits - 1)) && value < 1n << BigInt(type.bits - 1)
    : value >= 0n && value < 1n << BigInt(type.bits);
}

export function integer(value: bigint, type: IntType = INT): Integer {
  return {
    kind: "integer",
    type,
    value: type.signed ? BigInt.asIntN(type.bits, value) : BigInt.asUintN(type.bits, value)
  };
}

export function arithmeticInteger(value: bigint, type: IntType): Integer {
  if (type.signed && !fits(value, type)) throw new InspectionError("undefined", `Signed ${type.bits}-bit overflow.`);
  return integer(value, type);
}

export function cast(value: Value, target: FloatWidth): Floating;
export function cast(value: Value, target: IntType): Integer;
export function cast(value: Value, target: CType): Value;
export function cast(value: Value, target: CType): Value {
  if (typeof target === "number") {
    const number =
      value.kind === "float"
        ? target === 32
          ? Math.fround(value.value)
          : value.value
        : ratioFloat(value.value < 0n ? -value.value : value.value, 1n, value.value < 0n, target);
    return { kind: "float", width: target, value: number };
  }
  if (target.name === "_Bool") return integer(value.value === 0n || value.value === 0 ? 0n : 1n, target);
  if (value.kind === "integer") return integer(value.value, target);
  if (!Number.isFinite(value.value)) throw new InspectionError("undefined", "Non-finite float to integer conversion.");
  const truncated = BigInt(Math.trunc(value.value));
  if (!fits(truncated, target)) throw new InspectionError("undefined", "Float to integer conversion is out of range.");
  return integer(truncated, target);
}

export function promote(value: Integer): Integer {
  return value.type.rank < INT.rank ? integer(value.value, INT) : value;
}

export function commonIntegers(a: Integer, b: Integer): [Integer, Integer] {
  const left = promote(a);
  const right = promote(b);
  const high = left.type.rank >= right.type.rank ? left.type : right.type;
  let type = high;
  if (left.type.signed !== right.type.signed) {
    const unsigned = left.type.signed ? right.type : left.type;
    const signed = left.type.signed ? left.type : right.type;
    type =
      unsigned.rank >= signed.rank
        ? unsigned
        : signed.bits > unsigned.bits
          ? signed
          : { ...signed, signed: false, name: `unsigned ${signed.name}` };
  }
  return [integer(left.value, type), integer(right.value, type)];
}

export function typeName(value: Value): string {
  return value.kind === "float" ? `float${value.width}` : `${value.type.name} / ${value.type.bits}`;
}

/** The explicit target is Linux x86-64: LP64, signed char, GCC integer casts. */
export function parseType(source: string): CType | null {
  const name = source.trim().replace(/\s+/g, " ");
  if (name === "float") return 32;
  if (name === "double") return 64;
  if (name === "long double") throw new InspectionError("unsupported", "long double needs an 80-bit view.");
  if (name === "_Bool" || name === "bool") return { name: "_Bool", bits: 8, signed: false, rank: 0 };
  const fixed = name.match(/^(u?)int(8|16|32|64)_t$/);
  if (fixed) return fixedType(Number(fixed[2]), !fixed[1]);
  const ida = ["_BYTE", "_WORD", "_DWORD", "_QWORD"].indexOf(name);
  if (ida >= 0) return fixedType(8 * 2 ** ida, false);
  if (["size_t", "uintptr_t"].includes(name)) return ULONG;
  if (["ssize_t", "intptr_t", "ptrdiff_t"].includes(name)) return LONG;
  const words = name.split(" ");
  if (
    words.some(
      (word) =>
        !["unsigned", "signed", "char", "short", "int", "long", "__int8", "__int16", "__int32", "__int64"].includes(
          word
        )
    )
  )
    return null;
  if (
    words.filter((word) => word === "unsigned" || word === "signed").length > 1 ||
    words.filter((word) => word === "int").length > 1
  )
    return null;
  const unsigned = words.includes("unsigned");
  const base = words.filter((word) => word !== "unsigned" && word !== "signed" && word !== "int").join(" ");
  const type =
    base === ""
      ? INT
      : base === "long"
        ? LONG
        : base === "long long"
          ? LL
          : base === "char"
            ? fixedType(8, true)
            : base === "short"
              ? fixedType(16, true)
              : /^__int(?:8|16|32|64)$/.test(base)
                ? fixedType(Number(base.slice(5)), true)
                : null;
  if (!type || ((base === "char" || base.startsWith("__int")) && words.includes("int"))) return null;
  return { ...type, signed: !unsigned, name };
}

export function parseLiteral(source: string): Value {
  const float = source.match(
    /^(0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)p[+-]?\d+|(?:\d+\.\d*|\.\d+)(?:e[+-]?\d+)?|\d+e[+-]?\d+)([fl]?)$/i
  );
  if (float) {
    if (float[2]?.toLowerCase() === "l") throw new InspectionError("unsupported", "long double needs an 80-bit view.");
    const width = float[2]?.toLowerCase() === "f" ? 32 : 64;
    return { kind: "float", width, value: literalFloat(float[1] ?? "", width) };
  }
  const asm = source.match(/^([\da-f]+)h$/i);
  const match = (asm ? `0x${asm[1]}` : source).match(
    /^(0x[\da-f]+|0b[01]+|0o[0-7]+|\d+)(u(?:ll|l|i64)?|(?:ll|l|i64)u?)?$/i
  );
  if (!match) throw new InspectionError("invalid", "Invalid numeric literal.");
  if (/lL|Ll/.test(match[2] ?? "")) throw new InspectionError("invalid", "Invalid long long suffix.");
  const digits = match[1] ?? "";
  const suffix = (match[2] ?? "").toLowerCase().replace("i64", "ll");
  const octal = /^0\d/.test(digits);
  if (octal && /[89]/.test(digits)) throw new InspectionError("invalid", "Invalid octal literal.");
  const magnitude = BigInt(octal ? `0o${digits.slice(1)}` : digits);
  const decimal = !/^0[xbo]/i.test(digits) && !octal && !asm;
  const unsigned = suffix.includes("u");
  const rank = suffix.includes("ll") ? 5 : suffix.includes("l") ? 4 : 3;
  const candidates = (
    unsigned ? [UINT, ULONG, ULL] : decimal ? [INT, LONG, LL] : [INT, UINT, LONG, ULONG, LL, ULL]
  ).filter((type) => type.rank >= rank);
  const type = candidates.find((type) => fits(magnitude, type));
  if (!type) throw new InspectionError("unsupported", "Literal does not fit an LP64 C integer type.");
  return integer(magnitude, type);
}
