import { parse as parseYaml } from "yaml";

export type Frontmatter = Record<string, unknown>;

export function parsePhile(source: string): { data: Frontmatter; body: string } {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("Phile entries must start with YAML frontmatter.");
  }
  const rest = normalized.slice(4);
  const closing = /^---[\t ]*(?:\n|$)/m.exec(rest);
  if (!closing) {
    throw new Error("Phile frontmatter is missing a closing delimiter.");
  }
  const parsed: unknown = parseYaml(rest.slice(0, closing.index));
  const data = isFrontmatter(parsed) ? parsed : {};
  if (typeof data.date === "string" || typeof data.date === "number") {
    data.date = new Date(data.date);
  }
  if (typeof data.order === "string") {
    data.order = Number(data.order);
  }
  return { data, body: rest.slice(closing.index + closing[0].length) };
}

function isFrontmatter(value: unknown): value is Frontmatter {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
