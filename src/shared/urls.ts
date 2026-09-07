/** Validate before HTML/CSS encoding; escaping alone does not make a URL safe. */
export function safeUrl(input: string, kind: "link" | "image" | "font" = "link"): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject URL parser control characters deliberately.
  if (!input || /[\u0000-\u001f\u007f\\]/u.test(input)) {
    throw new Error(`Invalid ${kind} URL: ${JSON.stringify(input)}`);
  }
  const url = new URL(input, "https://entropic.invalid/");
  const allowed =
    url.protocol === "https:" || url.protocol === "http:" || (kind === "link" && url.protocol === "mailto:");
  if (!allowed) {
    throw new Error(`Unsupported ${kind} URL protocol: ${url.protocol}`);
  }
  return input;
}
