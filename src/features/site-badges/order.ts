import { randomInt } from "node:crypto";
import type { SiteBadge } from "./model";

/** Fisher–Yates shuffles a copy, keeping each image and its action together. */
export function shuffleBadgeOrder(
  badges: readonly SiteBadge[],
  randomIndex: (exclusiveMax: number) => number = randomInt
): readonly SiteBadge[] {
  const shuffled = [...badges];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];
    if (current !== undefined && replacement !== undefined) {
      shuffled[index] = replacement;
      shuffled[swapIndex] = current;
    }
  }
  return shuffled;
}
