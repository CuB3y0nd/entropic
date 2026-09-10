import type { Phile } from "@/features/philes";
import type { Volume } from "@/features/volumes";

export type SitemapEntry = {
  href: string;
};

const excerptSegments = new Intl.Segmenter("en", { granularity: "grapheme" });

export function absoluteUrl(site: URL, href: string): string {
  return new URL(href, site).toString();
}

export function phileExcerpt(phile: Phile, maxLength = 240): string {
  if (!Number.isSafeInteger(maxLength) || maxLength < 1) {
    throw new RangeError("Excerpt length must be a positive integer.");
  }
  if (phile.data.redacted) {
    return "[REDACTED]";
  }

  const text = plainText(phile.body ?? "");

  if (text.length <= maxLength) {
    return text;
  }

  const prefix: string[] = [];
  for (const { segment } of excerptSegments.segment(text)) {
    if (prefix.length === maxLength) {
      const suffix = ".".repeat(Math.min(3, maxLength));
      return `${prefix
        .slice(0, maxLength - suffix.length)
        .join("")
        .trimEnd()}${suffix}`;
    }
    prefix.push(segment);
  }
  return text;
}

export function renderRss(options: {
  site: URL;
  title: string;
  description: string;
  philes: readonly Phile[];
}): string {
  const philes = rssPhiles(options.philes);
  const latestDate = philes[0]?.data.date;

  return xmlDocument(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(absoluteUrl(options.site, "/"))}</link>
    <description>${escapeXml(options.description)}</description>
    ${latestDate ? `<lastBuildDate>${formatRssDate(latestDate)}</lastBuildDate>` : ""}
    <atom:link href="${escapeXml(absoluteUrl(options.site, "/rss.xml"))}" rel="self" type="application/rss+xml" />
${philes.map((phile) => renderRssItem(options.site, phile)).join("\n")}
  </channel>
</rss>`);
}

export function renderSitemap(site: URL, entries: SitemapEntry[]): string {
  return xmlDocument(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => renderSitemapEntry(site, entry)).join("\n")}
</urlset>`);
}

export function sitemapEntries(
  volumes: readonly Volume[],
  philes: readonly Phile[],
  extraPages: readonly string[] = []
): SitemapEntry[] {
  return [
    { href: "/" },
    ...extraPages.map((href) => ({ href })),
    { href: "/rss.xml" },
    ...volumes.map((volume) => ({
      href: volume.href
    })),
    ...philes.map((phile) => ({
      href: phile.route.href
    }))
  ];
}

function renderRssItem(site: URL, phile: Phile): string {
  const url = absoluteUrl(site, phile.route.href);

  return `    <item>
      <title>${escapeXml(phile.data.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${formatRssDate(phile.data.date)}</pubDate>
      ${phile.credits[0] ? `<dc:creator>${escapeXml(phile.credits[0].name)}</dc:creator>` : ""}
      <description>${escapeXml(phileExcerpt(phile))}</description>
    </item>`;
}

function rssPhiles(philes: readonly Phile[]): Phile[] {
  return [...philes].sort((left, right) => right.data.date.getTime() - left.data.date.getTime());
}

function plainText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function renderSitemapEntry(site: URL, entry: SitemapEntry): string {
  return `  <url>
    <loc>${escapeXml(absoluteUrl(site, entry.href))}</loc>
  </url>`;
}

function formatRssDate(date: Date): string {
  return date.toUTCString();
}

function escapeXml(value: string): string {
  return (
    value
      // XML 1.0 excludes these characters, including numeric references.
      // biome-ignore lint/suspicious/noControlCharactersInRegex: XML chars.
      .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;")
  );
}

function xmlDocument(input: string): string {
  return `${input.trim()}\n`;
}
