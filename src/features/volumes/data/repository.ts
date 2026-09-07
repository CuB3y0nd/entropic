import type { Phile } from "@/features/philes";
import { getAllPhiles } from "@/features/philes/server";
import type { Volume } from "../model";

export async function getAllVolumes(philes?: readonly Phile[]): Promise<Volume[]> {
  const allPhiles = philes ?? (await getAllPhiles());
  const philesByVolume = new Map<number, Phile[]>();

  for (const phile of allPhiles) {
    const volumePhiles = philesByVolume.get(phile.route.volume);

    if (volumePhiles) {
      volumePhiles.push(phile);
    } else {
      philesByVolume.set(phile.route.volume, [phile]);
    }
  }

  return [...philesByVolume.entries()]
    .sort(([left], [right]) => compareVolumes(left, right))
    .map(([number, volumePhiles]) => ({
      number,
      href: `/volume/${number}/`,
      philes: volumePhiles
    }));
}

function compareVolumes(left: number, right: number): number {
  return left - right;
}
