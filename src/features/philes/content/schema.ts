import { z } from "astro/zod";

export const requiredPhileFields = ["title", "date"] as const;

export const phileSchema = z.object({
  title: z.string().min(1),
  date: z.date(),
  lang: z.enum(["en", "zh"]).default("en"),
  slug: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  redacted: z.boolean().default(false)
});
