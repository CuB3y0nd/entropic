import { getCollection } from "astro:content";
import { volumeConfig } from "@/config/server";
import type { VolumePhileSort } from "@/config/types";
import type { Phile } from "../model";
import { routeForPhile } from "./routing";

let productionPhileCache: readonly Phile[] | undefined;

export async function getAllPhiles(): Promise<readonly Phile[]> {
  if (import.meta.env.PROD && productionPhileCache) {
    return productionPhileCache;
  }

  const entries = await getCollection("philes");
  const philes = entries.map((entry) => ({
    ...entry,
    route: routeForPhile(entry)
  }));

  assertUniqueSlugs(philes);

  const sorted = Object.freeze(philes.sort(comparePhiles));

  if (import.meta.env.PROD) {
    productionPhileCache = sorted;
  }

  return sorted;
}

function comparePhiles(left: Phile, right: Phile): number {
  if (left.route.volume !== right.route.volume) {
    return left.route.volume - right.route.volume;
  }

  const config = volumeConfig(left.route.volume);
  const sort = config.phileSort ?? { by: "date", direction: "desc" };
  const sorted = compareByVolumeSort(left, right, sort);

  if (sorted !== 0) {
    return sorted;
  }

  return left.route.slug.localeCompare(right.route.slug);
}

function compareByVolumeSort(left: Phile, right: Phile, sort: VolumePhileSort): number {
  if (sort.by === "date") {
    return compareDates(left, right, sort.direction);
  }

  const leftHasOrder = left.data.order !== undefined;
  const rightHasOrder = right.data.order !== undefined;

  const leftOrder = left.data.order;
  const rightOrder = right.data.order;

  if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
    return compareNumbers(leftOrder, rightOrder, sort.direction);
  }

  if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1;
  }

  return compareDates(left, right, "desc");
}

function compareDates(left: Phile, right: Phile, direction: VolumePhileSort["direction"]): number {
  return compareNumbers(left.data.date.getTime(), right.data.date.getTime(), direction);
}

function compareNumbers(left: number, right: number, direction: VolumePhileSort["direction"]): number {
  return direction === "asc" ? left - right : right - left;
}

function assertUniqueSlugs(philes: readonly Phile[]): void {
  const seen = new Map<string, string>();

  for (const phile of philes) {
    const key = `${phile.route.volume}/${phile.route.slug}`;
    const existing = seen.get(key);

    if (existing) {
      throw new Error(`Duplicate phile route "${key}" in "${existing}" and "${phile.route.sourcePath}".`);
    }

    seen.set(key, phile.route.sourcePath);
  }
}
