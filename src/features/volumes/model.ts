import type { Phile } from "@/features/philes";

export type Volume = {
  number: number;
  href: string;
  philes: readonly Phile[];
};
