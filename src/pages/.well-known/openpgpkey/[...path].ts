import type { APIRoute, GetStaticPaths } from "astro";
import { createWkdResources, type WkdResource } from "../../../modules/wkd/publication";

export const getStaticPaths: GetStaticPaths = async () => {
  const resources = await createWkdResources({
    email: import.meta.env.WKD_EMAIL,
    publicKeyPath: import.meta.env.WKD_PUBLIC_KEY_PATH
  });

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
