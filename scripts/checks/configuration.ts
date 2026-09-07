import { createWkdResources } from "../../src/features/wkd/publication.ts";

try {
  const { config } = await import("../../src/config/server.ts");
  await createWkdResources(config.wkd.enabled ? config.wkd : {});
  console.log("entropic.config.ts: settings, artwork selection, and optional WKD input are valid.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
