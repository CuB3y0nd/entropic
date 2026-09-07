import { defineCollection } from "astro:content";
import { phileLoader, phileSchema } from "@/features/philes/content";

const philes = defineCollection({
  loader: phileLoader(),
  schema: phileSchema
});

export const collections = { philes };
