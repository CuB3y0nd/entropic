import type { APIRoute, GetStaticPaths } from "astro";
import { config } from "@/config/server";
import { createWkdResources, type WkdResource } from "@/features/wkd/publication";

export const getStaticPaths: GetStaticPaths = async () => {
  const resources = await createWkdResources(config.wkd.enabled ? config.wkd : {});

  return resources.map((resource) => ({
    params: { path: resource.path },
    props: resource
  }));
};

export const GET: APIRoute = ({ props }) => {
  const resource = props as WkdResource;
  return new Response(resource.body, {
    headers: {
      "Content-Type": resource.contentType,
      "Access-Control-Allow-Origin": "*"
    }
  });
};
