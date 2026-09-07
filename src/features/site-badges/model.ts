import type { ImageMetadata } from "astro";

export type SiteBadge = {
  readonly label: string;
  readonly imageSrc: string;
} & ({ readonly href: string; readonly copyText?: never } | { readonly copyText: string; readonly href?: never });

export type ArtworkImage = {
  readonly source: ImageMetadata | string;
  readonly displayWidthPx: number;
  readonly displayHeightPx: number;
};

export type ArtworkPlacement =
  | "top"
  | "top-left"
  | "top-right"
  | "bottom"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right";

export type BadgeArtwork = ArtworkImage & {
  readonly placement?: ArtworkPlacement;
  readonly badgeOverlapPx?: number;
  readonly companion?: ArtworkImage & { readonly placement: "bottom-left" | "bottom-right" };
};
