export type AnsiToken = {
  text: string;
  roles?: string[];
};

type ParsedMarker = {
  roles: string[];
  text: string;
  end: number;
};

const ansiRoles = new Map<string, string>([
  ["k", "black"],
  ["black", "black"],
  ["r", "red"],
  ["red", "red"],
  ["g", "green"],
  ["green", "green"],
  ["y", "yellow"],
  ["yellow", "yellow"],
  ["b", "blue"],
  ["blue", "blue"],
  ["m", "magenta"],
  ["magenta", "magenta"],
  ["c", "cyan"],
  ["cyan", "cyan"],
  ["w", "white"],
  ["white", "white"],
  ["K", "bright-black"],
  ["br-black", "bright-black"],
  ["bright-black", "bright-black"],
  ["R", "bright-red"],
  ["br-red", "bright-red"],
  ["bright-red", "bright-red"],
  ["G", "bright-green"],
  ["br-green", "bright-green"],
  ["bright-green", "bright-green"],
  ["Y", "bright-yellow"],
  ["br-yellow", "bright-yellow"],
  ["bright-yellow", "bright-yellow"],
  ["B", "bright-blue"],
  ["br-blue", "bright-blue"],
  ["bright-blue", "bright-blue"],
  ["M", "bright-magenta"],
  ["br-magenta", "bright-magenta"],
  ["bright-magenta", "bright-magenta"],
  ["C", "bright-cyan"],
  ["br-cyan", "bright-cyan"],
  ["bright-cyan", "bright-cyan"],
  ["W", "bright-white"],
  ["br-white", "bright-white"],
  ["bright-white", "bright-white"],
  ["bold", "bold"],
  ["italic", "italic"],
  ["underline", "underline"],
  ["strike", "strike"]
]);

export function parseInlineAnsi(input: string): AnsiToken[] {
  const tokens: AnsiToken[] = [];
  let cursor = 0;
  let plain = "";

  while (cursor < input.length) {
    if (input[cursor] === "\\" && /[#[\]|\\]/.test(input[cursor + 1] ?? "")) {
      plain += input[cursor + 1];
      cursor += 2;
      continue;
    }

    if (input.startsWith("#[", cursor)) {
      const parsed = parseMarker(input, cursor);

      if (parsed) {
        flushPlain();
        tokens.push({ text: parsed.text, roles: parsed.roles });
        cursor = parsed.end;
        continue;
      }
    }

    plain += input[cursor];
    cursor += 1;
  }

  flushPlain();
  return tokens;

  function flushPlain(): void {
    if (plain.length > 0) {
      tokens.push({ text: plain });
      plain = "";
    }
  }
}

function parseMarker(input: string, start: number): ParsedMarker | undefined {
  const pipe = findUnescaped(input, "|", start + 2);

  if (pipe === -1) {
    return undefined;
  }

  const close = findUnescaped(input, "]", pipe + 1);

  if (close === -1) {
    return undefined;
  }

  const aliases = input
    .slice(start + 2, pipe)
    .trim()
    .split(";");
  const roles: string[] = [];

  for (const alias of aliases) {
    const trimmedAlias = alias.trim();
    const role = ansiRoles.get(trimmedAlias);

    if (!role) {
      throw new Error(`Unknown ANSI role "${trimmedAlias}".`);
    }

    roles.push(role);
  }

  return {
    roles,
    text: unescapeAnsiText(input.slice(pipe + 1, close)),
    end: close + 1
  };
}

function findUnescaped(input: string, needle: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === "\\" && index + 1 < input.length) {
      index += 1;
      continue;
    }

    if (input[index] === needle) {
      return index;
    }
  }

  return -1;
}

function unescapeAnsiText(input: string): string {
  return input.replace(/\\([#[\]|\\])/g, "$1");
}

export function roleForMask(char: string | undefined): string | undefined {
  if (!char || char === "." || char === " ") {
    return undefined;
  }

  const role = ansiRoles.get(char);

  if (!role) {
    throw new Error(`Unknown ink mask "${char}".`);
  }

  return role;
}
