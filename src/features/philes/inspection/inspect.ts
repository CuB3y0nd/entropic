import {
  asciiBytes,
  type ByteInput,
  bytesInteger,
  type Endian,
  hexBytes,
  integerBytes,
  parseBytes,
  permissionText
} from "./bytes";
import { cast, type Floating, fixedType, InspectionError, type Integer, integer, typeName } from "./c-values";
import { type Evaluation, evaluateExpression } from "./expression";
import { bitsFloat, type FloatWidth, floatBits, floatFields, floatText } from "./float";
import { INSPECTION_LIMITS } from "./limits";

export type InspectionRow = { label: string; value: string };
/** DOM option values are normalized against the choices valid for this input. */
export type InspectionOptions = { width?: string; view?: string; endian?: string };
type Choice<Value extends string = string> = { value: Value; label: string };
type Control<Value extends string = string> = {
  key: keyof InspectionOptions;
  label: string;
  value: Value;
  choices: Choice<Value>[];
};
export type Inspection = {
  kind: "integer" | "float" | "bytes" | "error";
  title: string;
  rows: InspectionRow[];
  controls: Control[];
  note: string | null;
};

/** One parsed selection, independent of the DOM; rendering never evaluates it again. */
export type PreparedInspection = { render: (options?: InspectionOptions) => Inspection };

const TARGET = "C / LP64 · int32, long64 · GCC casts";
const row = (label: string, value: string): InspectionRow => ({ label, value });
const choice = <Value extends string>(value: Value, label: string = value): Choice<Value> => ({ value, label });
const widths = [8, 16, 32, 64, 128, 256];

function control<Value extends string>(
  key: keyof InspectionOptions,
  label: string,
  choices: Choice<Value>[],
  requested: string | undefined,
  fallback: Value
): Control<Value> {
  return {
    key,
    label,
    choices,
    value: choices.find((entry) => entry.value === requested)?.value ?? fallback
  };
}

function endianControl(options: InspectionOptions): Control<Endian> {
  return control("endian", "ORDER", [choice("le", "LE"), choice("be", "BE")], options.endian, "le");
}

function floatRows(bits: bigint, width: FloatWidth): InspectionRow[] {
  const fields = floatFields(bits, width);
  const value = bitsFloat(bits, width);
  return [
    row("VALUE", floatText(value)),
    row(
      "HEX",
      `0x${BigInt.asUintN(width, bits)
        .toString(16)
        .padStart(width / 4, "0")}`
    ),
    row("CLASS", `${fields.sign === "1" ? "−" : "+"}${fields.kind}`),
    row("SIGN", fields.sign),
    row("EXP", fields.exponent),
    row("FRAC", fields.fraction)
  ];
}

function integerRows(value: Integer, width: number): InspectionRow[] {
  const bits = BigInt.asUintN(width, value.value);
  const signed = BigInt.asIntN(width, bits);
  const decimal = value.type.signed ? signed : bits;
  const rows = [
    row("DEC", decimal.toString()),
    row("HEX", `0x${bits.toString(16)}`),
    row("OCT", `0o${bits.toString(8)}`),
    row("BIN", `0b${bits.toString(2)}`)
  ];
  if (signed !== bits)
    rows.push(row(value.type.signed ? "UINT" : "SINT", (value.type.signed ? bits : signed).toString()));
  return rows;
}

function bitRows(value: bigint, width: number): InspectionRow[] {
  const bits = BigInt.asUintN(width, value);
  const binary = bits.toString(2).padStart(width, "0");
  const set: number[] = [];
  for (let index = width - 1; index >= 0; index--) {
    if (binary[index] === "1") set.push(width - 1 - index);
  }
  const half = width / 2;
  return [
    row("HEX", `0x${bits.toString(16)}`),
    row("BIN", `0b${binary}`),
    row("SET BITS", set.length ? set.join(", ") : "none"),
    row("POPCNT", String(set.length)),
    row(`LOW ${half}`, `0x${BigInt.asUintN(half, bits).toString(16)}`),
    row(`HIGH ${half}`, `0x${(bits >> BigInt(half)).toString(16)}`)
  ];
}

function inspectInteger(
  evaluation: Evaluation & { value: Integer },
  options: InspectionOptions,
  permissions: boolean,
  raw = false
): Inspection {
  const { value } = evaluation;
  const allowedWidths = widths.filter((width) => width <= 64 || width <= value.type.bits);
  const widthControl = control(
    "width",
    "BITS",
    allowedWidths.map((width) => choice(String(width))),
    options.width,
    String(value.type.bits)
  );
  const width = Number(widthControl.value);
  const choices: Choice[] = [
    choice("integer", "Integer"),
    choice("bits", "Bits"),
    choice("float32", "Float32 bits"),
    choice("float64", "Float64 bits")
  ];
  if (value.value >= 0n && value.value <= 0o7777n) choices.push(choice("permissions", "Permissions"));
  const view = control("view", "VIEW", choices, options.view, "integer");
  const controls = [view];
  const notes = [raw ? "Exact integer / outside LP64 literal range." : TARGET];
  let rows: InspectionRow[];
  if (view.value === "float32" || view.value === "float64") {
    const floatWidth = view.value === "float32" ? 32 : 64;
    rows = floatRows(value.value, floatWidth);
    const sourceBits =
      floatWidth > value.type.bits
        ? `${value.type.signed ? "Sign" : "Zero"} extended to ${floatWidth} bits`
        : `${floatWidth < value.type.bits ? "Low " : ""}${floatWidth} bits`;
    notes.push(`${sourceBits} reinterpreted as float${floatWidth}; no numeric conversion.`);
  } else if (view.value === "permissions") {
    const mode = permissionText(value.value);
    rows = [
      row("OCT", `0o${value.value.toString(8).padStart(4, "0")}`),
      row("MODE", mode),
      row("OWNER", mode.slice(0, 3)),
      row("GROUP", mode.slice(3, 6)),
      row("OTHER", mode.slice(6))
    ];
  } else {
    controls.push(widthControl);
    rows = view.value === "bits" ? bitRows(value.value, width) : integerRows(value, width);
    if (width !== value.type.bits) {
      notes.push(
        width < value.type.bits
          ? `Low ${width} bits; source ${value.value}.`
          : `${value.type.signed ? "Sign" : "Zero"} extended from ${value.type.bits} bits.`
      );
    }
    if (permissions) rows.push(row("MODE", permissionText(BigInt.asUintN(width, value.value))));
  }
  rows.unshift(row("TYPE", typeName(value)));
  if (evaluation.comparison) {
    const comparison = evaluation.comparison;
    rows.unshift(
      row("RESULT", comparison.result ? "true" : "false"),
      row("COMPARE", comparison.type),
      row("LEFT", comparison.left),
      row("RIGHT", comparison.right)
    );
  }
  return { kind: "integer", title: "INTEGER", rows, controls, note: notes.join(". ") };
}

function inspectFloat(value: Floating, options: InspectionOptions): Inspection {
  const view = control(
    "view",
    "VIEW",
    [choice("float32", "Float32"), choice("float64", "Float64")],
    options.view,
    `float${value.width}`
  );
  const width = view.value === "float32" ? 32 : 64;
  const converted = cast(value, width);
  const order = endianControl(options);
  const bits = floatBits(converted.value, width);
  const rows = [
    row("TYPE", `float${value.width}${width === value.width ? "" : ` → float${width}`}`),
    ...floatRows(bits, width),
    row("BYTES", hexBytes(integerBytes(bits, width, order.value)))
  ];
  return {
    kind: "float",
    title: "IEEE 754",
    rows,
    controls: [view, order],
    note:
      width === value.width ? "Round to nearest, ties to even." : "Numeric conversion; round to nearest, ties to even."
  };
}

function inspectByteInput(input: ByteInput, options: InspectionOptions): Inspection {
  const { bytes } = input;
  const choices: Choice[] = [
    choice("bytes", "Bytes"),
    choice("integer", "Integer"),
    choice("bits", "Bits"),
    choice("text", "Text")
  ];
  if (bytes.length >= 4) choices.push(choice("float32", "Float32"));
  if (bytes.length >= 8) choices.push(choice("float64", "Float64"));
  const view = control("view", "VIEW", choices, options.view, "bytes");
  const controls = [view];
  const notes: string[] = [];
  let rows = [row("HEX", hexBytes(bytes)), row("ASCII", asciiBytes(bytes))];
  if (view.value === "bytes") {
    if (bytes.length <= 8)
      rows.push(
        row("UINT LE", bytesInteger(bytes, "le").toString()),
        row("UINT BE", bytesInteger(bytes, "be").toString())
      );
    if (bytes.some((byte) => byte < 32 || byte > 126)) notes.push("ASCII: . = non-printable byte.");
  } else {
    const order = endianControl(options);
    controls.push(order);
    const endian = order.value;
    if (view.value === "text") {
      const data = new Uint8Array(bytes);
      const decode = (encoding: string): string => {
        try {
          return JSON.stringify(new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(data));
        } catch {
          return "invalid encoding";
        }
      };
      rows = [
        row("ASCII", asciiBytes(bytes)),
        row("UTF-8", decode("utf-8")),
        row("UTF-16", bytes.length % 2 ? "incomplete code unit" : decode(`utf-16${endian}`))
      ];
    } else {
      const numericWidths = widths.filter((width) => width <= bytes.length * 8 && width <= 64);
      const widthControl = control(
        "width",
        "BITS",
        numericWidths.map((width) => choice(String(width))),
        options.width,
        String(numericWidths.at(-1))
      );
      const floatWidth = view.value === "float32" ? 32 : view.value === "float64" ? 64 : null;
      const width = floatWidth ?? Number(widthControl.value);
      if (!floatWidth) controls.push(widthControl);
      const used = bytes.slice(0, width / 8);
      const bits = bytesInteger(used, endian);
      rows = floatWidth
        ? floatRows(bits, floatWidth)
        : view.value === "bits"
          ? bitRows(bits, width)
          : [
              row("SINT", BigInt.asIntN(width, bits).toString()),
              row("UINT", bits.toString()),
              ...integerRows(integer(bits, fixedType(width, false)), width).filter((entry) =>
                ["HEX", "OCT", "BIN"].includes(entry.label)
              )
            ];
      rows.unshift(row("BYTES", hexBytes(used)));
      notes.push(`First ${used.length} of ${bytes.length} bytes / ${endian.toUpperCase()}.`);
    }
  }
  if (input.address !== undefined) rows.unshift(row("ADDRESS", `0x${input.address.toString(16)}`));
  return {
    kind: "bytes",
    title: `${bytes.length} ${bytes.length === 1 ? "BYTE" : "BYTES"}`,
    rows,
    controls,
    note: notes.join(" ") || null
  };
}

function rawInteger(source: string): Integer | null {
  if (!/^[+-]?(?:0x[\da-f]+|0b[01]+|0o[0-7]+|[1-9]\d*|0)$/i.test(source)) return null;
  const negative = source.startsWith("-");
  const magnitude = BigInt(source.replace(/^[+-]/, ""));
  if (magnitude >= 1n << BigInt(INSPECTION_LIMITS.integerBits)) return null;
  const value = negative ? -magnitude : magnitude;
  const needed = negative ? (magnitude - 1n).toString(2).length + 1 : magnitude.toString(2).length;
  const bits = widths.find((width) => width >= needed);
  return bits ? integer(value, fixedType(bits, negative)) : null;
}

/** Parse once within fixed work bounds. Invalid syntax returns null; recognized
 * undefined/unsupported operations render a status instead of a numeric result. */
export function prepareInspection(selection: string): PreparedInspection | null {
  if (selection.length > INSPECTION_LIMITS.selectionLength) return null;
  const source = selection.trim();
  const bytes = parseBytes(source);
  if (bytes) return { render: (options = {}) => inspectByteInput(bytes, options) };
  if (!source || source.length > INSPECTION_LIMITS.expressionLength) return null;
  const mode = source.match(/^(?:chmod|mode)\s+(?:0o)?([0-7]{3,4})$/);
  try {
    const evaluation = evaluateExpression(mode ? `0o${mode[1]}` : source);
    const { value } = evaluation;
    if (value.kind === "float") return { render: (options = {}) => inspectFloat(value, options) };
    const permissions = Boolean(mode) || (/^0(?:o)?[0-7]+$/.test(source) && value.value <= 0o7777n);
    return { render: (options = {}) => inspectInteger({ ...evaluation, value }, options, permissions) };
  } catch (error) {
    if (!(error instanceof InspectionError)) throw error;
    if (error.category === "invalid") return null;
    if (error.category === "unsupported") {
      const raw = rawInteger(source);
      if (raw) return { render: (options = {}) => inspectInteger({ value: raw }, options, false, true) };
      if (/^[+-]?(?:0x[\da-f]+|\d+)$/i.test(source)) return null;
    }
    return {
      render: () => ({
        kind: "error",
        title: error.category.toUpperCase(),
        rows: [row("STATUS", error.message)],
        controls: [],
        note: TARGET
      })
    };
  }
}
