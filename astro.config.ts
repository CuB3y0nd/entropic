import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sharpImageService } from "astro/config";
import { config } from "./src/config/server.ts";
import { cvePagePath } from "./src/features/cves/index.ts";

export default defineConfig({
  site: config.site.url,
  // Astro must reload its own site URL when the application config changes.
  integrations: [
    {
      name: "entropic-config",
      hooks: {
        "astro:config:setup": ({ addWatchFile, injectRoute, config: astroConfig }) => {
          addWatchFile(new URL("./entropic.config.ts", astroConfig.root));
          if (config.wkd.enabled) addWatchFile(new URL(config.wkd.publicKeyPath, astroConfig.root));
          if (config.cves.enabled) {
            injectRoute({
              pattern: cvePagePath,
              entrypoint: new URL("./src/features/cves/components/CvePage.astro", import.meta.url),
              prerender: true
            });
          }
        }
      }
    }
  ],
  image: {
    service: sharpImageService({ webp: { lossless: true, effort: 6 } })
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
