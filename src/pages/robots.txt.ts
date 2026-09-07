import type { APIRoute } from "astro";
import { absoluteUrl, requireSite, xmlHeaders } from "@/features/seo";

export const GET: APIRoute = ({ site }) => {
  const siteUrl = requireSite(site, "Robots");

  return new Response(`User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(siteUrl, "/sitemap.xml")}\n`, {
    headers: xmlHeaders("text/plain")
  });
};
