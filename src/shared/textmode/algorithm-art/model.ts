export const algorithmKinds = ["life", "maze", "sort", "bits", "asm", "reorder"] as const;
export type AlgorithmKind = (typeof algorithmKinds)[number];

export type AlgorithmOptions = {
  readonly effects: readonly AlgorithmKind[];
  /** Pause the new effects. Life keeps its original playback behavior. */
  readonly animated: boolean;
  /** Playback multiplier for the new effects, 0.25..4. Life keeps its original timing. */
  readonly speed: number;
};

export const defaultAlgorithmOptions: AlgorithmOptions = {
  effects: algorithmKinds,
  animated: true,
  speed: 1
};

/** Rank each candidate separately: reordering the pool never changes an article's artwork. */
export function selectAlgorithm(key: string, effects: readonly AlgorithmKind[]): AlgorithmKind {
  let selected = effects[0];
  if (!selected) throw new RangeError("Article artwork needs at least one algorithm.");
  let highest = -1;
  for (const kind of effects) {
    const score = hashSeed(`${key}\0${kind}`);
    if (score > highest || (score === highest && kind < selected)) {
      selected = kind;
      highest = score;
    }
  }
  return selected;
}

export function hashSeed(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}
