import type { ArtworkImage, BadgeArtwork } from "./model";

export const badgeWidthPx = 88;
export const badgeHeightPx = 31;
export const badgeGapPx = 8;
const maximumBadgeColumns = 5;
const artworkSideGapPx = 16;

export function calculateBadgeLayout(badgeCount: number, artwork: BadgeArtwork | null) {
  if (!Number.isSafeInteger(badgeCount) || badgeCount < 0) {
    throw new Error("Badge count must be a non-negative integer.");
  }
  if (artwork) {
    validateArtworkSize(artwork);
    if (artwork.companion) validateArtworkSize(artwork.companion);
  }
  const overlapPx = artwork?.badgeOverlapPx ?? 0;
  if (!Number.isFinite(overlapPx) || overlapPx < 0) {
    throw new Error("Badge artwork overlap must be a non-negative pixel value.");
  }
  if (artwork) {
    const sidePlacement = artwork.placement === "left" || artwork.placement === "right";
    const artworkExtentPx = sidePlacement ? artwork.displayWidthPx : artwork.displayHeightPx;
    if (overlapPx >= artworkExtentPx) {
      throw new Error("Badge overlap must be smaller than the artwork along its placement axis.");
    }
  }
  const columnCount = Math.min(badgeCount, maximumBadgeColumns);
  const badgeGridWidthPx = columnCount * badgeWidthPx + Math.max(0, columnCount - 1) * badgeGapPx;
  const artworkWidthPx = artwork?.displayWidthPx ?? 0;
  const companionWidthPx = artwork?.companion?.displayWidthPx ?? 0;

  return {
    // An even panel width keeps centered, even-width badges on CSS pixels.
    panelWidthPx: Math.ceil(Math.max(artworkWidthPx, companionWidthPx, badgeGridWidthPx) / 2) * 2,
    horizontalPanelWidthPx:
      Math.max(badgeGridWidthPx, companionWidthPx) +
      artworkWidthPx +
      (artwork ? (overlapPx > 0 ? -overlapPx : artworkSideGapPx) : 0),
    artworkWidthPx,
    companionWidthPx,
    overlapPx
  };
}

function validateArtworkSize(image: ArtworkImage): void {
  if (
    !Number.isSafeInteger(image.displayWidthPx) ||
    image.displayWidthPx <= 0 ||
    !Number.isSafeInteger(image.displayHeightPx) ||
    image.displayHeightPx <= 0
  ) {
    throw new Error("Artwork display dimensions must be positive integer pixels.");
  }
}
