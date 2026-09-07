import type { APIRoute } from "astro";
import { siteConfig } from "@/config/server";
import { getAllPhiles } from "@/features/philes/server";
import { renderRss, requireSite, xmlHeaders } from "@/features/seo";

export const GET: APIRoute = async ({ site }) => {
  const philes = await getAllPhiles();

  return new Response(
    renderRss({
      site: requireSite(site, "RSS"),
      title: siteConfig.name,
      description: siteConfig.description,
      philes
    }),
    {
      headers: xmlHeaders("application/xml")
    }
  );
};
