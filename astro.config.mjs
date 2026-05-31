import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.cubeyond.net/",
  vite: {
    plugins: [tailwindcss()]
  }
});
