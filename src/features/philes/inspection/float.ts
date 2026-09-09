export type FloatWidth = 32 | 64;

// These synchronous conversions return primitives; the scratch storage never escapes.
const view = new DataView(new ArrayBuffer(8));

export function floatBits(value: number, width: FloatWidth): bigint {
  if (width === 32) {
    view.setFloat32(0, value);
    return BigInt(view.getUint32(0));
  }
  view.setFloat64(0, value);
  return view.getBigUint64(0);
}

export function bitsFloat(bits: bigint, width: FloatWidth): number {
  if (width === 32) {
    view.setUint32(0, Number(BigInt.asUintN(32, bits)));
    return view.getFloat32(0);
  }
  view.setBigUint64(0, BigInt.asUintN(64, bits));
  return view.getFloat64(0);
}

function roundedQuotient(numerator: bigint, denominator: bigint, shift: number): bigint {
  const n = shift >= 0 ? numerator << BigInt(shift) : numerator;
  const d = shift < 0 ? denominator << BigInt(-shift) : denominator;
  const quotient = n / d;
  const remainder = (n % d) * 2n;
  return quotient + (remainder > d || (remainder === d && (quotient & 1n) !== 0n) ? 1n : 0n);
}

/** Round once, directly to the target IEEE format (including halfway literals). */
export function ratioFloat(n: bigint, d: bigint, negative: boolean, width: FloatWidth): number {
  if (n === 0n) return negative ? -0 : 0;
  const fraction = width === 32 ? 23 : 52;
  const bias = width === 32 ? 127 : 1023;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < d << BigInt(exponent) : n << BigInt(-exponent) < d) exponent--;
  if (exponent > bias) return negative ? -Infinity : Infinity;
  if (exponent < -bias - fraction - 1) return negative ? -0 : 0;
  let significand = roundedQuotient(n, d, fraction - Math.max(exponent, 1 - bias));
  if (significand >= 1n << BigInt(fraction + 1)) {
    significand >>= 1n;
    exponent++;
  }
  if (exponent > bias) return negative ? -Infinity : Infinity;
  const normal = significand >= 1n << BigInt(fraction);
  const exponentBits = normal ? Math.max(exponent, 1 - bias) + bias : 0;
  const bits =
    (BigInt(negative ? 1 : 0) << BigInt(width - 1)) |
    (BigInt(exponentBits) << BigInt(fraction)) |
    (significand & ((1n << BigInt(fraction)) - 1n));
  return bitsFloat(bits, width);
}

export function literalFloat(source: string, width: FloatWidth): number {
  const hex = source.match(/^0x([\da-f]*)(?:\.([\da-f]*))?p([+-]?\d+)$/i);
  const decimal = source.match(/^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  const match = hex ?? decimal;
  if (!match) throw new Error("Invalid floating literal");
  const digits = `${match[1] ?? ""}${match[2] ?? ""}`.replace(/^0+/, "");
  const exponent = Number(match[3] ?? 0) - (match[2]?.length ?? 0) * (hex ? 4 : 1);
  if (!digits) return 0;
  // Reject only orders wholly outside the rounding boundary. Borderline values
  // still take the exact rational path, including ties and subnormals.
  const order = hex
    ? (digits.length - 1) * 4 + 31 - Math.clz32(Number.parseInt(digits[0] ?? "0", 16)) + exponent
    : digits.length - 1 + exponent;
  const maximum = hex ? (width === 32 ? 127 : 1023) : width === 32 ? 38 : 308;
  const minimum = hex ? (width === 32 ? -150 : -1075) : width === 32 ? -46 : -324;
  if (order > maximum) return Infinity;
  if (order < minimum) return 0;
  const n = BigInt(hex ? `0x${digits}` : digits);
  const power = (hex ? 2n : 10n) ** BigInt(Math.abs(exponent));
  return ratioFloat(exponent >= 0 ? n * power : n, exponent < 0 ? power : 1n, false, width);
}

export function floatText(value: number): string {
  if (Object.is(value, -0)) return "-0";
  return String(value);
}

export function floatFields(
  bits: bigint,
  width: FloatWidth
): { sign: string; exponent: string; fraction: string; kind: string } {
  const fractionWidth = width === 32 ? 23 : 52;
  const exponentWidth = width === 32 ? 8 : 11;
  const binary = BigInt.asUintN(width, bits).toString(2).padStart(width, "0");
  const exponent = binary.slice(1, 1 + exponentWidth);
  const fraction = binary.slice(1 + exponentWidth);
  const e = Number.parseInt(exponent, 2);
  const f = bits & ((1n << BigInt(fractionWidth)) - 1n);
  const kind =
    e === 0
      ? f === 0n
        ? "zero"
        : "subnormal"
      : e === 2 ** exponentWidth - 1
        ? f === 0n
          ? "infinity"
          : "NaN"
        : "normal";
  return { sign: binary.slice(0, 1), exponent, fraction, kind };
}
