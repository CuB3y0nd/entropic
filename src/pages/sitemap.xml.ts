import type { APIRoute } from "astro";
import { config } from "@/config/server";
import { cvePagePath } from "@/features/cves";
import { getAllPhiles } from "@/features/philes/server";
import { renderSitemap, requireSite, sitemapEntries, xmlHeaders } from "@/features/seo";
import { getAllVolumes } from "@/features/volumes/server";

export const GET: APIRoute = async ({ site }) => {
  const philes = await getAllPhiles();
  const volumes = await getAllVolumes(philes);

  const extraPages = config.cves.enabled ? [cvePagePath] : [];
  return new Response(renderSitemap(requireSite(site, "Sitemap"), sitemapEntries(volumes, philes, extraPages)), {
    headers: xmlHeaders("application/xml")
  });
};
