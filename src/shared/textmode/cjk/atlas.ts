import { cjkAtlas } from "@/generated/cjk-atlas";

const glyphs: Readonly<Record<string, number>> = cjkAtlas.glyphs;

export function cjkAtlasStyle(char: string): string | undefined {
  const index = glyphs[char];

  if (index === undefined) {
    return undefined;
  }

  const x = -(index % cjkAtlas.columns) * cjkAtlas.cellSize;
  const y = -Math.floor(index / cjkAtlas.columns) * cjkAtlas.cellSize;

  return `--cjk-x:${x}px;--cjk-y:${y}px`;
}
