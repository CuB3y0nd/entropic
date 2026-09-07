export function requireSite(site: URL | undefined, target: string): URL {
  if (!site) {
    throw new Error(`${target} generation requires astro.config.mjs site.`);
  }

  return site;
}

export function xmlHeaders(contentType: "application/rss+xml" | "application/xml" | "text/plain"): HeadersInit {
  return {
    "Cache-Control": "public, max-age=3600",
    "Content-Type": `${contentType}; charset=utf-8`
  };
}
