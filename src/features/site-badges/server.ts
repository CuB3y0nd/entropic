import { config } from "@/config/server";
import type { ArtworkSelection } from "@/config/types";
import { badgeArtworkPresets } from "./artwork/presets";
import type { ArtworkRotation } from "./artwork/rotation";
import type { BadgeArtwork } from "./model";
import { shuffleBadgeOrder } from "./order";

const selection = config.buttons.artwork;
// Shuffle once per build; artwork changes and reloads keep this order.
export const siteBadges =
  import.meta.env.PROD && config.buttons.shuffleOnBuild
    ? shuffleBadgeOrder(config.buttons.items)
    : config.buttons.items;
export const fixedBadgeArtwork = resolveFixedArtwork(selection);
export const badgeArtworkRotation = resolveRotation(selection);
export const rotationPresets = selectPresets(selection);

function resolveFixedArtwork(artwork: ArtworkSelection): BadgeArtwork | null {
  if (!artwork) return null;
  switch (artwork.mode) {
    case "custom":
      return artwork.artwork;
    case "fixed":
      return badgeArtworkPresets[artwork.preset];
    default:
      return artwork.fallback === null ? null : badgeArtworkPresets[artwork.fallback ?? "nagaraNozomi"];
  }
}

function resolveRotation(artwork: ArtworkSelection): ArtworkRotation | null {
  if (!artwork) return null;
  switch (artwork.mode) {
    case "fixed":
    case "custom":
      return null;
    case "visit":
      return { mode: "visit" };
    case "daily":
      return { mode: "daily", timeZone: artwork.timeZone, seed: artwork.seed ?? "entropic-artwork-v1" };
    case "interval":
      return { mode: "interval", hours: artwork.hours, seed: artwork.seed ?? "entropic-artwork-v1" };
  }
}

function selectPresets(artwork: ArtworkSelection) {
  const all = Object.entries(badgeArtworkPresets);
  if (!artwork || artwork.mode === "custom" || artwork.mode === "fixed" || !artwork.presets) return all;
  const selected = new Set<string>(artwork.presets);
  return all.filter(([id]) => selected.has(id));
}
