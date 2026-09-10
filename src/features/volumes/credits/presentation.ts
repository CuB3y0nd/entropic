import type { PhileCredit } from "@/features/philes";
import { cellWidth } from "@/shared/textmode";

export const creditAuthorWidth = 22;

export function hasCreditDetails(credits: readonly PhileCredit[]): boolean {
  return credits.length > 1 || cellWidth(credits[0]?.name ?? "") > creditAuthorWidth;
}
