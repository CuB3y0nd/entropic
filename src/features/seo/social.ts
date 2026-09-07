const cardSegments = new Intl.Segmenter("en", { granularity: "grapheme" });

/** Keep card copy compact without splitting a visible Unicode character. */
export function twitterCardText(input: string, field: "title" | "description"): string {
  const limit = field === "title" ? 70 : 200;
  const text = input.replace(/\s+/gu, " ").trim();
  if (text.length <= limit) return text;

  let prefix = "";
  for (const { segment } of cardSegments.segment(text)) {
    if (prefix.length + segment.length > limit - 1) break;
    prefix += segment;
  }
  return `${prefix.trimEnd()}…`;
}
