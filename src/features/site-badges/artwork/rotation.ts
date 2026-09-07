export type ArtworkRotation =
  | { readonly mode: "daily"; readonly timeZone: string; readonly seed: string }
  | { readonly mode: "interval"; readonly hours: number; readonly seed: string }
  | { readonly mode: "visit" };

/** Validate author configuration during the build, before it reaches the browser. */
export function validateArtworkRotation(rotation: ArtworkRotation): void {
  switch (rotation.mode) {
    case "daily":
      if (!rotation.timeZone) throw new Error("Daily artwork rotation requires an explicit time zone.");
      new Intl.DateTimeFormat("en", { timeZone: rotation.timeZone }).format(0);
      break;
    case "interval":
      if (!Number.isSafeInteger(rotation.hours) || rotation.hours < 1 || rotation.hours > 8760) {
        throw new Error("Artwork rotation hours must be an integer between 1 and 8760.");
      }
      break;
    case "visit":
      return;
    default:
      throw new Error("Unknown artwork rotation mode.");
  }
  if (typeof rotation.seed !== "string" || !rotation.seed.trim()) {
    throw new Error("Scheduled artwork rotation requires a non-empty seed.");
  }
}
