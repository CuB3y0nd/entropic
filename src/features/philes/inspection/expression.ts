import {
  arithmeticInteger,
  type CType,
  cast,
  commonIntegers,
  fixedType,
  InspectionError,
  type Integer,
  integer,
  parseLiteral,
  parseType,
  promote,
  typeName,
  type Value
} from "./c-values";
import { bitsFloat, floatText } from "./float";

type Node =
  | { kind: "literal"; value: Value }
  | { kind: "cast"; target: CType; child: Node }
  | { kind: "unary"; op: string; child: Node }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "conditional"; condition: Node; yes: Node; no: Node }
  | { kind: "helper"; name: string; args: Node[] };

export type Evaluation = { value: Value; comparison?: { type: string; left: string; right: string; result: boolean } };
const precedence: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "<": 7,
  "<=": 7,
  ">": 7,
  ">=": 7,
  "<<": 8,
  ">>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10
};
const comparisonOperators = new Set(["==", "!=", "<", "<=", ">", ">="]);
const helperPattern =
  /^(?:S?(?:LOBYTE|HIBYTE|LOWORD|HIWORD|LODWORD|HIDWORD|BYTE[0-7]|WORD[0-3]|DWORD[01])|__(?:ROL|ROR)[1248]__|__PAIR(?:16|32|64)__|COERCE_(?:FLOAT|DOUBLE))$/;

function tokenize(source: string): string[] {
  const tokens: string[] = [];
  let rest = source;
  while (rest.length) {
    rest = rest.trimStart();
    if (!rest) break;
    const match = rest.match(
      /^(?:'(?:\\(?:x[\da-fA-F]+|[0-7]{1,3}|[^\n])|[^'\\\n])+'|(?:\d|\.\d)(?:[\w.]|(?<=[eEpP])[+-])*|[a-zA-Z_]\w*|<<|>>|<=|>=|==|!=|&&|\|\||[()+\-*/%~!&|^<>,?:])/
    );
    if (!match || tokens.length >= 128) throw new InspectionError("invalid", "Invalid or oversized expression.");
    tokens.push(match[0]);
    rest = rest.slice(match[0].length);
  }
  return tokens;
}

function character(token: string): Value {
  const body = token.slice(1, -1);
  const simple: Record<string, number> = {
    "\\0": 0,
    "\\n": 10,
    "\\r": 13,
    "\\t": 9,
    "\\v": 11,
    "\\b": 8,
    "\\f": 12,
    "\\a": 7,
    "\\\\": 92,
    "\\'": 39,
    '\\"': 34,
    "\\?": 63
  };
  const value =
    simple[body] ??
    (/^\\x[\da-f]+$/i.test(body)
      ? Number.parseInt(body.slice(2), 16)
      : /^\\[0-7]{1,3}$/.test(body)
        ? Number.parseInt(body.slice(1), 8)
        : body.length === 1
          ? body.charCodeAt(0)
          : -1);
  if (value < 0 || value > 127)
    throw new InspectionError("unsupported", "Character constants support single ASCII bytes.");
  return integer(BigInt(value));
}

class Parser {
  private position = 0;
  constructor(private readonly tokens: string[]) {}

  private take(expected?: string): string {
    const token = this.tokens[this.position++];
    if (!token || (expected && token !== expected)) throw new InspectionError("invalid", "Incomplete expression.");
    return token;
  }

  parse(minimum = 0, depth = 0): Node {
    if (depth > 32) throw new InspectionError("invalid", "Expression nesting limit.");
    let left = this.prefix(depth + 1);
    for (;;) {
      const op = this.tokens[this.position] ?? "";
      const priority = precedence[op];
      if (priority === undefined || priority < minimum) break;
      this.position++;
      left = { kind: "binary", op, left, right: this.parse(priority + 1, depth + 1) };
    }
    if (minimum === 0 && this.tokens[this.position] === "?") {
      this.position++;
      const yes = this.parse(0, depth + 1);
      this.take(":");
      left = { kind: "conditional", condition: left, yes, no: this.parse(0, depth + 1) };
    }
    return left;
  }

  private prefix(depth: number): Node {
    if (depth > 32) throw new InspectionError("invalid", "Expression nesting limit.");
    const token = this.take();
    if (["+", "-", "~", "!"].includes(token)) return { kind: "unary", op: token, child: this.prefix(depth + 1) };
    if (token === "(") {
      const start = this.position;
      while (/^[a-zA-Z_]\w*$/.test(this.tokens[this.position] ?? "")) this.position++;
      const target =
        this.tokens[this.position] === ")" ? parseType(this.tokens.slice(start, this.position).join(" ")) : null;
      if (target !== null) {
        this.position++;
        return { kind: "cast", target, child: this.prefix(depth + 1) };
      }
      this.position = start;
      const node = this.parse(0, depth + 1);
      this.take(")");
      return node;
    }
    if (helperPattern.test(token)) {
      this.take("(");
      const args = [this.parse(0, depth + 1)];
      while (this.tokens[this.position] === "," && args.length < 3) {
        this.position++;
        args.push(this.parse(0, depth + 1));
      }
      this.take(")");
      return { kind: "helper", name: token, args };
    }
    if (/^(?:NAN|INFINITY|nan|inf|infinity)$/.test(token)) {
      return {
        kind: "literal",
        value: {
          kind: "float",
          width: token === token.toUpperCase() ? 32 : 64,
          value: /nan/i.test(token) ? NaN : Infinity
        }
      };
    }
    return { kind: "literal", value: token.startsWith("'") ? character(token) : parseLiteral(token) };
  }

  finish(): Node {
    const node = this.parse();
    if (this.position !== this.tokens.length) throw new InspectionError("invalid", "Not a constant expression.");
    return node;
  }
}

function truth(value: Value): boolean {
  return value.value !== 0n && value.value !== 0;
}

function ints(a: Value, b: Value): [Integer, Integer] {
  if (a.kind !== "integer" || b.kind !== "integer")
    throw new InspectionError("invalid", "This operator needs integers.");
  return [a, b];
}

function common(a: Value, b: Value): [Value, Value] {
  if (a.kind === "integer" && b.kind === "integer") return commonIntegers(a, b);
  const width = (a.kind === "float" && a.width === 64) || (b.kind === "float" && b.width === 64) ? 64 : 32;
  return [cast(a, width), cast(b, width)];
}

function compare(op: string, a: number | bigint, b: number | bigint): boolean {
  switch (op) {
    case "==":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    default:
      return a >= b;
  }
}

function binary(op: string, a: Value, b: Value, run: boolean): Value {
  if (op === "&&" || op === "||") return integer(BigInt(op === "&&" ? truth(a) && truth(b) : truth(a) || truth(b)));
  if (op === "<<" || op === ">>") {
    const [first, second] = ints(a, b).map(promote);
    if (!first || !second) throw new InspectionError("invalid", "Missing shift operand.");
    if (!run) return integer(0n, first.type);
    const count = second.value;
    if (count < 0n || count >= BigInt(first.type.bits))
      throw new InspectionError("undefined", "Shift count is outside the promoted left operand's width.");
    if (op === "<<" && first.type.signed && first.value < 0n)
      throw new InspectionError("undefined", "Left shift of a negative signed value.");
    return op === "<<"
      ? arithmeticInteger(first.value << count, first.type)
      : integer(first.value >> count, first.type);
  }
  const [left, right] = common(a, b);
  if (comparisonOperators.has(op)) return integer(BigInt(compare(op, left.value, right.value)));
  if (["%", "&", "|", "^"].includes(op)) ints(left, right);
  if (left.kind === "float" && right.kind === "float") {
    const x = left.value;
    const y = right.value;
    const value = !run ? 0 : op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : x / y;
    return { ...left, value: left.width === 32 ? Math.fround(value) : value };
  }
  const [x, y] = ints(left, right);
  if (!run) return integer(0n, x.type);
  if ((op === "/" || op === "%") && y.value === 0n) throw new InspectionError("undefined", "Integer division by zero.");
  if ((op === "/" || op === "%") && x.type.signed && x.value === -(1n << BigInt(x.type.bits - 1)) && y.value === -1n) {
    throw new InspectionError("undefined", "Signed division overflow.");
  }
  switch (op) {
    case "+":
      return arithmeticInteger(x.value + y.value, x.type);
    case "-":
      return arithmeticInteger(x.value - y.value, x.type);
    case "*":
      return arithmeticInteger(x.value * y.value, x.type);
    case "/":
      return arithmeticInteger(x.value / y.value, x.type);
    case "%":
      return integer(x.value % y.value, x.type);
    case "&":
      return integer(x.value & y.value, x.type);
    case "|":
      return integer(x.value | y.value, x.type);
    default:
      return integer(x.value ^ y.value, x.type);
  }
}

function helper(name: string, args: Value[], run: boolean): Value {
  const first = args[0];
  if (first?.kind !== "integer") throw new InspectionError("invalid", "Helper needs integer operands.");
  const pair = name.match(/^__PAIR(16|32|64)__$/);
  const rotate = name.match(/^__(ROL|ROR)([1248])__$/);
  if (pair || rotate) {
    const second = args[1];
    if (args.length !== 2 || second?.kind !== "integer")
      throw new InspectionError("invalid", "Helper needs two integers.");
    const width = pair ? Number(pair[1]) : Number(rotate?.[2]) * 8;
    if (!run) return integer(0n, fixedType(width, false));
    if (pair)
      return integer(
        (BigInt.asUintN(width / 2, first.value) << BigInt(width / 2)) | BigInt.asUintN(width / 2, second.value),
        fixedType(width, false)
      );
    const count = Number(((second.value % BigInt(width)) + BigInt(width)) % BigInt(width));
    const shift = rotate?.[1] === "ROL" ? count : (width - count) % width;
    const bits = BigInt.asUintN(width, first.value);
    return integer((bits << BigInt(shift)) | (bits >> BigInt(width - shift)), fixedType(width, false));
  }
  if (args.length !== 1) throw new InspectionError("invalid", "Helper needs one integer.");
  if (name.startsWith("COERCE_")) {
    const width = name === "COERCE_FLOAT" ? 32 : 64;
    if (first.type.bits !== width)
      throw new InspectionError("unsupported", `COERCE needs a ${width}-bit source; cast its width first.`);
    return { kind: "float", width, value: bitsFloat(first.value, width) };
  }
  const signed = name.startsWith("S");
  const part = signed ? name.slice(1) : name;
  const size = part.includes("DWORD") ? 32 : part.includes("WORD") ? 16 : 8;
  const index = /\d$/.test(part) ? Number(part.at(-1)) : part.startsWith("HI") ? first.type.bits / size - 1 : 0;
  if (index < 0 || (index + 1) * size > first.type.bits)
    throw new InspectionError("unsupported", "Helper reads beyond the operand's width.");
  // The target is little-endian. HIBYTE is the highest memory byte of the operand.
  return integer(BigInt.asUintN(first.type.bits, first.value) >> BigInt(index * size), fixedType(size, signed));
}

function evaluate(node: Node, run = true): Value {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "cast": {
      const child = evaluate(node.child, run);
      return cast(
        run ? child : child.kind === "integer" ? integer(0n, child.type) : { ...child, value: 0 },
        node.target
      );
    }
    case "unary": {
      const child = evaluate(node.child, run);
      if (node.op === "!") return integer(BigInt(!truth(child)));
      if (child.kind === "float") {
        if (node.op === "~") throw new InspectionError("invalid", "Bitwise complement needs an integer.");
        return { ...child, value: node.op === "-" ? -child.value : child.value };
      }
      const value = promote(child);
      return node.op === "+"
        ? value
        : node.op === "~"
          ? integer(~value.value, value.type)
          : arithmeticInteger(run ? -value.value : 0n, value.type);
    }
    case "binary": {
      const left = evaluate(node.left, run);
      const rightRuns = run && !(node.op === "&&" && !truth(left)) && !(node.op === "||" && truth(left));
      return binary(node.op, left, evaluate(node.right, rightRuns), run);
    }
    case "conditional": {
      const condition = truth(evaluate(node.condition, run));
      const [yes, no] = common(evaluate(node.yes, run && condition), evaluate(node.no, run && !condition));
      return condition ? yes : no;
    }
    case "helper":
      return helper(
        node.name,
        node.args.map((arg) => evaluate(arg, run)),
        run
      );
  }
}

export function evaluateExpression(source: string): Evaluation {
  const node = new Parser(tokenize(source)).finish();
  const value = evaluate(node);
  if (node.kind !== "binary" || !comparisonOperators.has(node.op)) return { value };
  const [left, right] = common(evaluate(node.left), evaluate(node.right));
  const text = (entry: Value): string => (entry.kind === "integer" ? entry.value.toString() : floatText(entry.value));
  return { value, comparison: { type: typeName(left), left: text(left), right: text(right), result: truth(value) } };
}
