import { z } from "astro/zod";
import { algorithmKinds } from "@/shared/textmode/algorithm-art/model";

export const requiredPhileFields = ["title", "date"] as const;

export const phileSchema = z.object({
  title: z.string().min(1),
  date: z.date(),
  lang: z.enum(["en", "zh"]).default("en"),
  slug: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  redacted: z.boolean().default(false),
  decoration: z.union([z.enum(algorithmKinds), z.literal(false)]).optional()
});
