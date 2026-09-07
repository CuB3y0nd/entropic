export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

export function maybe(probability: number): boolean {
  return Math.random() < probability;
}
