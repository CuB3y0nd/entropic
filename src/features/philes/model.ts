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
  /** The original author comes first, followed by contributors in first-commit order. */
  credits: readonly PhileCredit[];
};

export type PhileCredit = {
  name: string;
  login?: string;
  href?: string;
};
