import type { CollectionEntry } from "astro:content";

export type PhileEntry = CollectionEntry<"philes">;

export type PhileRoute = {
  volume: number;
  slug: string;
  href: string;
  volumeHref: string;
  sourcePath: string;
};

export type Phile = PhileEntry & {
  route: PhileRoute;
};
