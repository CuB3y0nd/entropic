import type { PhileEntry, PhileRoute } from "../model";

const volumePathPattern = /^volume-(\d+)\/(.+?)(?:\.phile)?$/;

export function routeForPhile(entry: PhileEntry): PhileRoute {
  const match = entry.id.match(volumePathPattern);

  if (!match) {
    throw new Error(`Invalid phile path "${entry.id}". Expected content/philes/volume-<number>/**/*.phile.`);
  }

  const volume = Number(match[1]);
  if (!Number.isSafeInteger(volume)) {
    throw new Error(`Invalid volume number in "${entry.id}".`);
  }
  const pathWithoutVolume = match[2] ?? "";
  const basename = pathWithoutVolume.split("/").at(-1);
  const slug = entry.data.slug ?? basename?.toLowerCase();

  // biome-ignore lint/suspicious/noControlCharactersInRegex: A route segment cannot contain control characters.
  if (!slug || slug === "." || slug === ".." || /[\\/?#\u0000-\u001f\u007f]/u.test(slug)) {
    throw new Error(`Unable to derive slug for "${entry.id}".`);
  }

  return {
    volume,
    slug,
    href: `/volume/${volume}/${encodeURIComponent(slug)}/`,
    volumeHref: `/volume/${volume}/`,
    sourcePath: entry.id
  };
}
